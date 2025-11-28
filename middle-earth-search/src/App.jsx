import { useState, useEffect, useRef } from 'react';
import { dotProduct } from './utils';
import './App.css';

const BOOKS = [
  "The Fellowship of the Ring", 
  "The Two Towers", 
  "The Return of the King"
];

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]); // Now holds ALL matches
  const [visibleLimit, setVisibleLimit] = useState(5);
  const [status, setStatus] = useState('initiating');
  const [progress, setProgress] = useState('Waiting for AI Library...');
  const [selectedBooks, setSelectedBooks] = useState(BOOKS); // Default: All checked
  const [downloadProgress, setDownloadProgress] = useState(0);

  const pipeRef = useRef(null);
  const dataRef = useRef(null);

  useEffect(() => {
    async function init() {
      const waitForLibrary = setInterval(async () => {
        if (window.transformers) {
          clearInterval(waitForLibrary);
          try {
            const { pipeline, env } = window.transformers;
            env.allowLocalModels = false;
            env.useBrowserCache = false;

            // 1. Pass a callback to track download progress
            pipeRef.current = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
              progress_callback: (data) => {
                // 'data' contains status ('progress'/'done') and file info
                if (data.status === 'progress') {
                  // data.progress is 0 to 100
                  setDownloadProgress(Math.round(data.progress));
                  setProgress(`Summoning Neural Network... (${Math.round(data.progress)}%)`);
                } else if (data.status === 'done') {
                  setDownloadProgress(100); 
                }
              }
            });

            // 2. Fetch Data (We can't easily track progress here without complex code, 
            // so we just set it to 'indeterminate' state visually)
            setProgress('Unrolling Ancient Scrolls (Parsing Data)...');
            setDownloadProgress(100); // Keep bar full while processing JSON
            
            const response = await fetch('/embeddings.json');
            dataRef.current = await response.json();

            setStatus('ready');
          } catch (e) {
            console.error(e);
            setProgress('Error: ' + e.message);
          }
        }
      }, 100);
    }
    init();
  }, []);

  const handleBookToggle = (book) => {
    if (selectedBooks.includes(book)) {
      setSelectedBooks(selectedBooks.filter(b => b !== book));
    } else {
      setSelectedBooks([...selectedBooks, book]);
    }
  };

const handleSearch = async () => {
    if (!query || !pipeRef.current || !dataRef.current) return;
    setStatus('searching');
    
    const output = await pipeRef.current(query, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(output.data);
    const lowerQuery = query.toLowerCase();

    const scored = dataRef.current
      .filter(record => selectedBooks.includes(record.book))
      .map(record => {
        const semanticScore = dotProduct(record.vector, queryVector);
        const isExactMatch = record.text.toLowerCase().includes(lowerQuery);
        return {
          ...record,
          score: semanticScore + (isExactMatch ? 0.5 : 0),
          isExactMatch
        };
      });

    // CHANGE: We no longer slice here. We keep ALL sorted results.
    const sortedResults = scored.sort((a, b) => b.score - a.score);

    setResults(sortedResults);
    setVisibleLimit(5); // Reset to show only top 5 on a new search
    setStatus('ready');
  };

  const handleLoadMore = () => {
    setVisibleLimit(prev => prev + 5); // Show 5 more
  };

  const visibleResults = results.slice(0, visibleLimit);

  return (
    <div className="container">
      <h1 className="header">🧙‍♂️ Middle Earth Semantic Search</h1>
      
      {status === 'initiating' ? (
        <div className="loading-box">
          <p className="loading-text">{progress}</p>
          <div className="progress-container">
            <div 
              className="progress-fill" 
              style={{ width: `${downloadProgress}%` }}
            ></div>
          </div>
        </div>
      ) : (
        <>
          {/* FILTER UI */}
          <div className="filter-box">
            {BOOKS.map(book => (
              <label key={book} className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={selectedBooks.includes(book)}
                  onChange={() => handleBookToggle(book)}
                />
                {book}
              </label>
            ))}
          </div>

          <div className="search-box">
            <input 
              type="text" 
              value={query} 
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Gaze into the Palantír..."  // <--- UPDATED
            />
            <button onClick={handleSearch} disabled={status === 'searching'}>
              {status === 'searching' ? 'Searching...' : 'Search'}
            </button>
          </div>
        </>
      )}

      <div className="results">
        {visibleResults.map((r) => (
          <ResultCard key={r.id} result={r} fullDataset={dataRef.current} />
        ))}
      </div>

      {status === 'ready' && results.length > visibleLimit && (
        <button className="btn-load-more" onClick={handleLoadMore}>
          Unearth More Secrets
        </button>
      )}

      <footer className="footer">
        <p> 
          <a 
            href="https://github.com/robmcelhinney/MiddleEarthSemanticSearch/" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            View Source in the Archives
          </a>
        </p>
      </footer>
    </div>
  );
}

// --- SUB COMPONENT FOR CONTEXT ---

function ResultCard({ result, fullDataset }) {
  const [showContext, setShowContext] = useState(false);

  // Because our IDs are sequential (0,1,2...), we can just use array index
  // However, checking ids is safer if sorting ever changes
  const prevParagraph = showContext ? fullDataset[result.id - 1] : null;
  const nextParagraph = showContext ? fullDataset[result.id + 1] : null;

  return (
    <div className="card">
      <div className="card-header">
        <span className="book-tag">{result.book}</span>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {result.isExactMatch && <span className="badge-exact">🎯 Exact Match</span>}
          <span className="score">Match: {Math.min(100, (result.score * 100)).toFixed(0)}%</span>
        </div>
      </div>

      <div className="card-content">
        {/* Previous Context */}
        {showContext && prevParagraph && (
          <p className="context-text">... {prevParagraph.text}</p>
        )}

        {/* The Main Match */}
        <p className="main-text">"{result.text}"</p>

        {/* Next Context */}
        {showContext && nextParagraph && (
          <p className="context-text">{nextParagraph.text} ...</p>
        )}
      </div>

      <button 
        className="btn-context" 
        onClick={() => setShowContext(!showContext)}
      >
        {showContext ? 'Collapse Context' : 'Show Context'}
      </button>
    </div>
  );
}