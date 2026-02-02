const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.VITE_PINECONE_API_KEY;
const RAW_HOST = process.env.PINECONE_HOST || process.env.VITE_PINECONE_HOST;
const PINECONE_HOST = RAW_HOST?.replace(/^https?:\/\//, ''); // Normalize host
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

const KJV_URL = 'https://cdn.jsdelivr.net/gh/thiagobodruk/bible@master/json/en_kjv.json';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for required environment variables
  if (!PINECONE_API_KEY || !PINECONE_HOST || !GEMINI_API_KEY) {
    return res.status(500).json({ 
      error: 'Missing required environment variables',
      missing: {
        PINECONE_API_KEY: !PINECONE_API_KEY,
        PINECONE_HOST: !PINECONE_HOST,
        GEMINI_API_KEY: !GEMINI_API_KEY
      }
    });
  }

  // Optional: Start from a specific batch (for resuming)
  const startBatch = parseInt(req.body?.startBatch) || 0;
  const maxBatches = parseInt(req.body?.maxBatches) || 10; // Process 10 batches at a time to avoid timeout

  try {
    // Fetch the KJV Bible
    const bibleRes = await fetch(KJV_URL);
    const bible = await bibleRes.json();
    
    // Parse verses
    const verses = [];
    for (const book of bible) {
      const bookName = book.name;
      for (let chapterIdx = 0; chapterIdx < book.chapters.length; chapterIdx++) {
        const chapter = book.chapters[chapterIdx];
        for (let verseIdx = 0; verseIdx < chapter.length; verseIdx++) {
          verses.push({
            reference: `${bookName} ${chapterIdx + 1}:${verseIdx + 1}`,
            text: chapter[verseIdx],
            book: bookName,
            chapter: chapterIdx + 1,
            verse: verseIdx + 1
          });
        }
      }
    }

    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(verses.length / BATCH_SIZE);
    const endBatch = Math.min(startBatch + maxBatches, totalBatches);
    
    let processedCount = 0;
    const errors = [];

    for (let batchIdx = startBatch; batchIdx < endBatch; batchIdx++) {
      const i = batchIdx * BATCH_SIZE;
      const batch = verses.slice(i, i + BATCH_SIZE);
      
      try {
        // Get embeddings from Gemini
        const embeddingRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: batch.map(v => ({
                model: 'models/text-embedding-004',
                content: { parts: [{ text: `${v.reference}: ${v.text}` }] }
              }))
            })
          }
        );
        
        const embeddingData = await embeddingRes.json();
        
        if (!embeddingData.embeddings) {
          errors.push({ batch: batchIdx, error: 'No embeddings returned', details: embeddingData });
          continue;
        }
        
        // Prepare vectors for Pinecone
        const vectors = batch.map((v, idx) => ({
          id: v.reference.replace(/[^a-zA-Z0-9]/g, '_'),
          values: embeddingData.embeddings[idx].values,
          metadata: { 
            reference: v.reference, 
            text: v.text, 
            book: v.book, 
            chapter: v.chapter, 
            verse: v.verse 
          }
        }));
        
        // Upsert to Pinecone
        const pineconeRes = await fetch(`https://${PINECONE_HOST}/vectors/upsert`, {
          method: 'POST',
          headers: {
            'Api-Key': PINECONE_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ vectors, namespace: 'kjv' })
        });
        
        if (!pineconeRes.ok) {
          const errorText = await pineconeRes.text();
          errors.push({ batch: batchIdx, error: 'Pinecone upsert failed', details: errorText });
          continue;
        }
        
        processedCount += batch.length;
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 500));
        
      } catch (batchError) {
        errors.push({ batch: batchIdx, error: batchError.message });
      }
    }

    const isComplete = endBatch >= totalBatches;
    
    return res.status(200).json({
      success: true,
      message: isComplete ? 'Embedding complete!' : 'Batch complete, continue with next batch',
      totalVerses: verses.length,
      totalBatches,
      processedBatches: { from: startBatch, to: endBatch },
      processedVerses: processedCount,
      nextBatch: isComplete ? null : endBatch,
      isComplete,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to process Bible embeddings',
      details: error.message 
    });
  }
}
