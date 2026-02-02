"use client";

import { useState, useEffect } from 'react';

interface PineconeStatus {
  configured: boolean;
  indexStats?: {
    namespaces?: Record<string, { vectorCount: number }>;
    dimension?: number;
    totalVectorCount?: number;
  };
  kjvNamespace?: {
    exists: boolean;
    vectorCount: number;
    expectedCount: number;
    percentComplete: number;
    isReady: boolean;
  };
  error?: string;
}

interface RAGSearchResult {
  results?: Array<{
    reference: string;
    text: string;
    score: number;
  }>;
  totalFound?: number;
  error?: string;
}

export function RAGAdmin({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<PineconeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testQuery, setTestQuery] = useState('comfort for the weary');
  const [testResults, setTestResults] = useState<RAGSearchResult | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pinecone-status');
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch Pinecone status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const testRAGSearch = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const res = await fetch('/api/pinecone-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery, topK: 5 }),
      });
      const data = await res.json();
      setTestResults(data);
    } catch (err) {
      setTestResults({ error: 'Search failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#050505] to-[#02040a] text-amber-100/90 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 rounded-full border border-amber-100/20 hover:border-amber-100/40 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          </button>
          <div>
            <h1 className="text-2xl font-serif text-amber-100">RAG System Admin</h1>
            <p className="text-sm text-amber-100/50">Manage Bible verse embeddings</p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {/* Status Card */}
        <div className="mb-6 p-6 bg-amber-100/5 border border-amber-100/10 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif">Pinecone Status</h2>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 rounded-full border border-amber-100/20 hover:border-amber-100/40 transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-amber-100/50"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            </div>
          ) : status ? (
            <div className="space-y-4">
              {/* Connection Status */}
              <div className="flex items-center justify-between py-2 border-b border-amber-100/10">
                <span className="text-amber-100/60">Connection</span>
                <div className="flex items-center gap-2">
                  {status.configured ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                      <span className="text-green-400">Connected</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                      <span className="text-red-400">Not Configured</span>
                    </>
                  )}
                </div>
              </div>

              {/* KJV Namespace */}
              {status.kjvNamespace && (
                <>
                  <div className="flex items-center justify-between py-2 border-b border-amber-100/10">
                    <span className="text-amber-100/60">KJV Namespace</span>
                    <span className={status.kjvNamespace.exists ? 'text-green-400' : 'text-yellow-400'}>
                      {status.kjvNamespace.exists ? 'Exists' : 'Not Created'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-amber-100/10">
                    <span className="text-amber-100/60">Verses Embedded</span>
                    <span>
                      {status.kjvNamespace.vectorCount.toLocaleString()} / {status.kjvNamespace.expectedCount.toLocaleString()}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="py-2">
                    <div className="h-2 bg-amber-100/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
                        style={{ width: `${status.kjvNamespace.percentComplete}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-amber-100/40">
                      <span>{status.kjvNamespace.percentComplete}% complete</span>
                      <span className={status.kjvNamespace.isReady ? 'text-green-400' : 'text-yellow-400'}>
                        {status.kjvNamespace.isReady ? 'RAG Ready' : 'Needs More Data'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-amber-100/40 text-center py-4">Unable to load status</p>
          )}
        </div>

        {/* Test Search Card */}
        <div className="p-6 bg-amber-100/5 border border-amber-100/10 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-100/60"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <h2 className="text-lg font-serif">Test RAG Search</h2>
          </div>

          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Enter search query..."
              className="flex-1 px-4 py-2 bg-amber-100/5 border border-amber-100/20 rounded-full text-sm focus:outline-none focus:border-amber-100/40"
            />
            <button
              onClick={testRAGSearch}
              disabled={testing || !status?.kjvNamespace?.vectorCount}
              className="px-6 py-2 bg-amber-100/10 border border-amber-100/20 rounded-full text-sm hover:border-amber-100/40 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {testing ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              )}
              Search
            </button>
          </div>

          {/* Test Results */}
          {testResults && (
            <div className="p-4 bg-amber-100/5 rounded-lg max-h-64 overflow-y-auto">
              {testResults.error ? (
                <p className="text-red-400 text-sm">{testResults.error}</p>
              ) : testResults.results && testResults.results.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-amber-100/40 mb-2">Found {testResults.totalFound} results:</p>
                  {testResults.results.map((r, i) => (
                    <div key={i} className="p-3 bg-amber-100/5 rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-amber-100 font-medium text-sm">{r.reference}</span>
                        <span className="text-xs text-amber-100/40">Score: {(r.score * 100).toFixed(1)}%</span>
                      </div>
                      <p className="text-xs text-amber-100/60 line-clamp-2">{r.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-amber-100/40 text-sm">No results found</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RAGAdmin;
