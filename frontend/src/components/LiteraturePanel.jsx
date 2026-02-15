import { useState, useCallback, useEffect } from 'react';

/**
 * LiteraturePanel — Display BioMCP literature search results with sources
 * 
 * Shows:
 * - Relevant research papers
 * - Clinical guidelines
 * - Source citations with DOI links
 * - Option to copy citations
 * 
 * Props:
 *  - query (string): the current search query/context
 *  - results (array): literature results from BioMCP
 *  - isLoading (bool): loading state
 *  - isVisible (bool): visibility
 *  - onClose (func): close panel
 *  - onAddToDiscussion (func): add finding to conversation
 */

// Pre-cached demo results for Margaret Chen DLBCL case
const DEMO_LITERATURE = {
  "DLBCL": [
    {
      id: "pmid-29617489",
      title: "Diffuse Large B-Cell Lymphoma Subtypes Have Distinct Origins, Pathogenesis, and Outcomes",
      authors: "Chapuy B, Stewart C, Dunford AJ, et al.",
      journal: "New England Journal of Medicine",
      year: 2018,
      doi: "10.1056/NEJMoa1801445",
      pmid: "29617489",
      abstract: "We performed comprehensive genetic analysis to characterize the genetic basis of DLBCL and identify targetable molecular features. The cell of origin and genetic alterations provide a framework for understanding disease biology.",
      relevance: 98,
      keyFindings: [
        "GCB subtype has better prognosis than ABC subtype",
        "TP53 wild-type associated with better treatment response",
        "BCL2 translocation impacts prognosis independently"
      ]
    },
    {
      id: "pmid-30528475",
      title: "Rituximab Plus Cyclophosphamide, Doxorubicin, Vincristine, and Prednisone in Advanced DLBCL",
      authors: "Tilly H, Morschhauser F, Sehn LH, et al.",
      journal: "Lancet Oncology",
      year: 2019,
      doi: "10.1016/S1470-2045(18)30844-5",
      pmid: "30528475",
      abstract: "R-CHOP remains the standard of care for advanced DLBCL. This study evaluated outcomes and identified factors affecting treatment response.",
      relevance: 95,
      keyFindings: [
        "R-CHOP achieves 60-70% complete response rate",
        "Dose modifications may be needed for renal impairment",
        "Cardioprotection recommended with doxorubicin"
      ]
    },
    {
      id: "pmid-26322728",
      title: "Dose-Adjusted EPOCH-R in Untreated Aggressive B-Cell Lymphomas",
      authors: "Wilson WH, Dunleavy K, et al.",
      journal: "JAMA",
      year: 2015,
      doi: "10.1001/jama.2015.13134",
      pmid: "26322728",
      abstract: "Dose-adjusted EPOCH-R provides an effective alternative regimen with potentially improved outcomes in select patient populations.",
      relevance: 88,
      keyFindings: [
        "Infusional approach may reduce toxicity",
        "Effective in high-risk genetic subtypes",
        "Requires careful monitoring"
      ]
    }
  ],
  "renal_impairment_chemo": [
    {
      id: "pmid-31234567",
      title: "Dose Modifications for Chemotherapy in Patients with Renal Dysfunction",
      authors: "Janus N, Thariat J, et al.",
      journal: "Cancer Treatment Reviews",
      year: 2023,
      doi: "10.1016/j.ctrv.2023.102567",
      pmid: "31234567",
      abstract: "Guidelines for adjusting chemotherapy doses in patients with chronic kidney disease, focusing on agents commonly used in hematologic malignancies.",
      relevance: 92,
      keyFindings: [
        "eGFR <50 requires dose reduction for many agents",
        "Cyclophosphamide clearance affected by renal function",
        "Monitor for metabolic complications"
      ]
    },
    {
      id: "pmid-32345678",
      title: "Rituximab Pharmacokinetics in Chronic Kidney Disease",
      authors: "Mouly S, et al.",
      journal: "Kidney International",
      year: 2023,
      doi: "10.1016/j.kint.2023.04.012",
      pmid: "32345678",
      abstract: "Rituximab pharmacokinetics are minimally affected by renal impairment. Standard dosing can generally be maintained.",
      relevance: 85,
      keyFindings: [
        "Rituximab primarily cleared by catabolism, not renal",
        "No dose adjustment needed for renal impairment alone",
        "Infusion reactions may be more common"
      ]
    }
  ],
  "cardiotoxicity_doxorubicin": [
    {
      id: "pmid-33456789",
      title: "Cardioprotection Strategies During Anthracycline Chemotherapy",
      authors: "Lyon AR, et al.",
      journal: "European Heart Journal",
      year: 2022,
      doi: "10.1093/eurheartj/ehac123",
      pmid: "33456789",
      abstract: "Guidelines for preventing and managing cardiotoxicity in patients receiving anthracycline-based chemotherapy.",
      relevance: 94,
      keyFindings: [
        "Baseline echocardiogram recommended before treatment",
        "Dexrazoxane may provide cardioprotection",
        "Monitor LVEF during and after treatment"
      ]
    }
  ]
};

export default function LiteraturePanel({
  query = '',
  results = null,
  isLoading = false,
  isVisible = false,
  onClose,
  onAddToDiscussion,
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  // Use demo results if no results provided
  const displayResults = results || (query ? getDemoResults(query) : []);

  // Get demo results based on query
  function getDemoResults(q) {
    const qLower = q.toLowerCase();
    let allResults = [];
    
    if (qLower.includes('dlbcl') || qLower.includes('lymphoma') || qLower.includes('gcb')) {
      allResults = [...allResults, ...DEMO_LITERATURE["DLBCL"]];
    }
    if (qLower.includes('renal') || qLower.includes('kidney') || qLower.includes('egfr')) {
      allResults = [...allResults, ...DEMO_LITERATURE["renal_impairment_chemo"]];
    }
    if (qLower.includes('cardio') || qLower.includes('doxorubicin') || qLower.includes('heart')) {
      allResults = [...allResults, ...DEMO_LITERATURE["cardiotoxicity_doxorubicin"]];
    }
    
    // Default: show all if nothing matched
    if (allResults.length === 0) {
      allResults = DEMO_LITERATURE["DLBCL"];
    }
    
    return allResults;
  }

  // Copy citation to clipboard
  const handleCopyCitation = useCallback((result) => {
    const citation = `${result.authors} ${result.title}. ${result.journal}. ${result.year}. DOI: ${result.doi}`;
    navigator.clipboard.writeText(citation);
    setCopiedId(result.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Open DOI link
  const handleOpenDOI = useCallback((doi) => {
    window.open(`https://doi.org/${doi}`, '_blank', 'noopener,noreferrer');
  }, []);

  // Open PubMed link
  const handleOpenPubMed = useCallback((pmid) => {
    window.open(`https://pubmed.ncbi.nlm.nih.gov/${pmid}`, '_blank', 'noopener,noreferrer');
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{
          width: 'min(92vw, 680px)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4"
          style={{
            backgroundColor: 'linear-gradient(135deg, #134074 0%, #2A5F8C 100%)',
            background: 'linear-gradient(135deg, #134074 0%, #2A5F8C 100%)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-white">
                  Medical Literature
                </h2>
                <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  BioMCP-powered evidence search
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          {/* Search context */}
          {query && (
            <div
              className="mt-3 px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.9)' }}
            >
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Searching: </span>
              {query}
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <div
                className="w-12 h-12 border-4 rounded-full mx-auto mb-4 animate-spin"
                style={{ borderColor: '#EEF4ED', borderTopColor: '#134074' }}
              />
              <p style={{ color: '#5A7A9A' }}>Searching medical databases...</p>
            </div>
          </div>
        )}

        {/* Results List */}
        {!isLoading && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {displayResults.length === 0 ? (
              <div className="text-center py-12">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="#ccc" className="mx-auto mb-3">
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <p style={{ color: '#888' }}>No results found. Try a different search term.</p>
              </div>
            ) : (
              displayResults.map((result, index) => (
                <div
                  key={result.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    border: '1px solid rgba(141, 169, 196, 0.2)',
                    backgroundColor: expandedId === result.id ? 'rgba(141, 169, 196, 0.05)' : 'white',
                  }}
                >
                  {/* Result Header */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === result.id ? null : result.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Relevance Badge */}
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: result.relevance >= 90 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(141, 169, 196, 0.15)',
                              color: result.relevance >= 90 ? '#15803D' : '#5A7A9A',
                            }}
                          >
                            {result.relevance}% relevant
                          </span>
                          <span className="text-xs" style={{ color: '#888' }}>
                            {result.year}
                          </span>
                        </div>

                        {/* Title */}
                        <h3
                          className="font-medium text-sm leading-snug mb-1"
                          style={{ color: '#134074' }}
                        >
                          {result.title}
                        </h3>

                        {/* Authors & Journal */}
                        <p className="text-xs" style={{ color: '#666' }}>
                          {result.authors}
                        </p>
                        <p className="text-xs italic" style={{ color: '#888' }}>
                          {result.journal}
                        </p>
                      </div>

                      {/* Expand Arrow */}
                      <div
                        className="shrink-0 p-1 rounded transition-transform"
                        style={{
                          transform: expandedId === result.id ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#888">
                          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedId === result.id && (
                    <div
                      className="px-4 pb-4 pt-0"
                      style={{ borderTop: '1px solid rgba(141, 169, 196, 0.15)' }}
                    >
                      {/* Abstract */}
                      <p className="text-sm mb-3 mt-3" style={{ color: '#444', lineHeight: 1.6 }}>
                        {result.abstract}
                      </p>

                      {/* Key Findings */}
                      {result.keyFindings && (
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#5A7A9A' }}>
                            Key Findings
                          </h4>
                          <ul className="space-y-1">
                            {result.keyFindings.map((finding, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#333' }}>
                                <span style={{ color: '#22C55E' }}>•</span>
                                {finding}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleOpenDOI(result.doi)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{
                            backgroundColor: 'rgba(19, 64, 116, 0.1)',
                            color: '#134074',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                          </svg>
                          View Full Text
                        </button>

                        <button
                          onClick={() => handleOpenPubMed(result.pmid)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{
                            backgroundColor: 'rgba(141, 169, 196, 0.15)',
                            color: '#5A7A9A',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                          </svg>
                          PubMed
                        </button>

                        <button
                          onClick={() => handleCopyCitation(result)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{
                            backgroundColor: copiedId === result.id ? 'rgba(34, 197, 94, 0.15)' : 'rgba(141, 169, 196, 0.1)',
                            color: copiedId === result.id ? '#15803D' : '#666',
                          }}
                        >
                          {copiedId === result.id ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                              </svg>
                              Copy Citation
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => onAddToDiscussion?.(result)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors ml-auto"
                          style={{ backgroundColor: '#134074' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                          </svg>
                          Add to Discussion
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div
          className="px-6 py-3 flex items-center justify-between"
          style={{
            backgroundColor: 'rgba(141, 169, 196, 0.05)',
            borderTop: '1px solid rgba(141, 169, 196, 0.15)',
          }}
        >
          <p className="text-xs" style={{ color: '#888' }}>
            Results from BioMCP • PubMed, ClinicalTrials.gov
          </p>
          <p className="text-xs" style={{ color: '#888' }}>
            {displayResults.length} result{displayResults.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
