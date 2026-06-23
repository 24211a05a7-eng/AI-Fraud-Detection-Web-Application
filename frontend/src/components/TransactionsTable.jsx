import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Check, 
  AlertTriangle,
  User, 
  Globe, 
  Activity, 
  TrendingUp, 
  ExternalLink 
} from 'lucide-react';

export default function TransactionsTable({ apiBase, onAuditUpdate }) {
  const [txns, setTxns] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [minRisk, setMinRisk] = useState('');
  const [selectedTxn, setSelectedTxn] = useState(null);
  
  // Pagination
  const [limit, setLimit] = useState(15);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      let url = `${apiBase}/transactions?limit=${limit}&offset=${offset}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (typeFilter) url += `&txn_type=${typeFilter}`;
      if (minRisk) url += `&min_risk=${minRisk}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTxns(data);
        // If we get fewer records than the limit, we know we've reached the end
        setHasMore(data.length === limit);
      }
    } catch (e) {
      console.error("Failed to load historical transactions:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [offset, statusFilter, typeFilter, minRisk, limit]);

  // Reset pagination on filter change
  const handleFilterChange = (filterType, val) => {
    if (filterType === 'status') setStatusFilter(val);
    if (filterType === 'type') setTypeFilter(val);
    if (filterType === 'risk') setMinRisk(val);
    setOffset(0);
    setPage(1);
  };

  const handleNextPage = () => {
    if (hasMore) {
      setOffset(prev => prev + limit);
      setPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(prev => Math.max(0, prev - limit));
      setPage(prev => Math.max(1, prev - 1));
    }
  };

  // Perform quick resolution (Confirm Fraud / Clear Legitimate)
  const handleResolve = async (txnId, newStatus) => {
    try {
      const response = await fetch(`${apiBase}/transactions/${txnId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        const updated = await response.json();
        // Update local list
        setTxns(prev => prev.map(t => t.id === txnId ? updated : t));
        if (selectedTxn && selectedTxn.id === txnId) {
          setSelectedTxn(updated);
        }
        onAuditUpdate();
      }
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  };

  // Filter local records by origin/destination search (since backend serves paginated, local search matches loaded set)
  const filteredTxns = txns.filter(t => 
    t.origin_id.toLowerCase().includes(search.toLowerCase()) ||
    t.dest_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full gap-6 animate-fade-in relative">
      
      {/* Ledger Table Section */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col min-w-0 h-full justify-between shadow-sm">
        
        {/* Table Filters and Search Header */}
        <div className="p-5 border-b border-slate-200 space-y-4 shrink-0">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Search Box */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
              <input 
                type="text" 
                placeholder="Search Account ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg pl-9 pr-4 py-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400"
              />
            </div>
            
            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
              
              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-semibold rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Channels</option>
                <option value="UPI">UPI</option>
                <option value="IMPS">IMPS</option>
                <option value="RTGS">RTGS</option>
                <option value="NEFT">NEFT</option>
                <option value="CASH_OUT">CASH_OUT</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-semibold rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="pending_review">Pending Review</option>
                <option value="flagged_fraud">Flagged Fraud</option>
                <option value="cleared_legitimate">Cleared Legitimate</option>
              </select>

              {/* Risk Filter */}
              <select
                value={minRisk}
                onChange={(e) => handleFilterChange('risk', e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-semibold rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Risks</option>
                <option value="0.7">High Risk (&ge;70%)</option>
                <option value="0.3">Med/High Risk (&ge;30%)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ledger Grid */}
        <div className="flex-1 overflow-x-auto min-h-0">
          <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3 w-[15%]">Timestamp</th>
                <th className="px-6 py-3 w-[25%]">Accounts (Origin &rarr; Dest)</th>
                <th className="px-6 py-3 w-[12%]">Channel</th>
                <th className="px-6 py-3 w-[13%]">Amount</th>
                <th className="px-6 py-3 w-[12%]">Risk Rating</th>
                <th className="px-6 py-3 w-[13%]">Status</th>
                <th className="px-6 py-3 w-[10%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredTxns.map((t) => {
                const isSelected = selectedTxn && selectedTxn.id === t.id;
                const riskPercent = (t.risk_score * 100).toFixed(0);
                
                return (
                  <tr 
                    key={t.id} 
                    onClick={() => setSelectedTxn(t)}
                    className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                      isSelected ? 'bg-slate-50' : ''
                    } ${t.risk_score >= 0.7 && t.status === 'flagged_fraud' ? 'bg-rose-50/20' : ''}`}
                  >
                    {/* Timestamp */}
                    <td className="px-6 py-4 truncate text-slate-400">
                      {new Date(t.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    {/* Source/Dest */}
                    <td className="px-6 py-4 truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">{t.origin_id}</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span className="text-slate-500">{t.dest_id}</span>
                      </div>
                    </td>
                    {/* Type */}
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-600 tracking-wide text-[10px] bg-slate-100 px-2 py-0.5 rounded uppercase">
                        {t.type}
                      </span>
                    </td>
                    {/* Amount */}
                    <td className="px-6 py-4 font-bold text-slate-900">
                      ₹{t.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                    </td>
                    {/* Risk Rating */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-10 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0">
                          <div 
                            className={`h-full rounded-full ${
                              t.risk_score >= 0.7 ? 'bg-rose-500' : t.risk_score >= 0.3 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${riskPercent}%` }}
                          />
                        </div>
                        <span className={`font-bold ${
                          t.risk_score >= 0.7 ? 'text-rose-500' : t.risk_score >= 0.3 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {riskPercent}%
                        </span>
                      </div>
                    </td>
                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        t.status === 'flagged_fraud' 
                          ? 'bg-rose-50 text-rose-700 border-rose-100'
                          : t.status === 'cleared_legitimate'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    {/* Action buttons */}
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {t.status === 'pending_review' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleResolve(t.id, 'cleared_legitimate')}
                            className="p-1 rounded bg-slate-50 hover:bg-green-50 hover:text-green-600 text-slate-500 border border-slate-200 transition-colors"
                            title="Mark Legitimate"
                          >
                            <Check size={13} className="stroke-[2.5]" />
                          </button>
                          <button
                            onClick={() => handleResolve(t.id, 'flagged_fraud')}
                            className="p-1 rounded bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-500 border border-slate-200 transition-colors"
                            title="Confirm Fraud"
                          >
                            <X size={13} className="stroke-[2.5]" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold uppercase select-none">RESOLVED</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredTxns.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-20 text-slate-400 font-semibold">
                    {isLoading ? "Querying database records..." : "No matching transactions found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 font-medium">
            Page <span className="font-bold text-slate-700">{page}</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevPage}
              disabled={offset === 0 || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Details Side-Drawer */}
      {selectedTxn && (
        <aside className="w-80 bg-white border border-slate-200 rounded-xl flex flex-col shadow-lg shrink-0 h-full overflow-hidden">
          
          {/* Drawer Header */}
          <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Security Audit Report</h3>
              <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mt-0.5 block">ID: #{selectedTxn.id}</span>
            </div>
            <button 
              onClick={() => setSelectedTxn(null)}
              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Drawer Body Scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* Amount / Risk block */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transaction Amount</span>
              <span className="text-2xl font-bold text-slate-900 block mt-1">
                ₹{selectedTxn.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}
              </span>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200">
                <span className={`w-2 h-2 rounded-full ${
                  selectedTxn.risk_score >= 0.7 ? 'bg-rose-500' : selectedTxn.risk_score >= 0.3 ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
                <span className="text-xs font-bold text-slate-700">Consensus Risk: {(selectedTxn.risk_score * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* Account Details */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Information</h4>
              <div className="bg-slate-25 border border-slate-100 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1 text-slate-400">
                    <User size={13} />
                    Origin
                  </span>
                  <span className="font-semibold text-slate-800">{selectedTxn.origin_id}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1 text-slate-400">
                    <ExternalLink size={13} />
                    Destination
                  </span>
                  <span className="font-semibold text-slate-800">{selectedTxn.dest_id}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Globe size={13} />
                    Location
                  </span>
                  <span className="font-medium text-slate-800">{selectedTxn.location}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Activity size={13} />
                    IP Address
                  </span>
                  <span className="font-medium text-slate-800">{selectedTxn.ip_address}</span>
                </div>
              </div>
            </div>

            {/* Balance Shifts */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Balance Ledgers</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="border border-slate-100 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Origin Pre</span>
                  <span className="font-bold text-slate-700 block mt-0.5">₹{selectedTxn.old_balance_org.toLocaleString('en-IN')}</span>
                  
                  <span className="text-[9px] font-bold text-slate-400 block uppercase mt-2">Origin Post</span>
                  <span className="font-bold text-slate-800 block mt-0.5">₹{selectedTxn.new_balance_orig.toLocaleString('en-IN')}</span>
                </div>
                <div className="border border-slate-100 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Dest Pre</span>
                  <span className="font-bold text-slate-700 block mt-0.5">₹{selectedTxn.old_balance_dest.toLocaleString('en-IN')}</span>
                  
                  <span className="text-[9px] font-bold text-slate-400 block uppercase mt-2">Dest Post</span>
                  <span className="font-bold text-slate-800 block mt-0.5">₹{selectedTxn.new_balance_dest.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Model Breakdown */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ML Classification Breakdown</h4>
              <div className="space-y-2 text-xs font-semibold">
                
                {/* Logistic regression */}
                <div className="flex items-center justify-between p-2 border border-slate-100 rounded-lg">
                  <span className="text-slate-600">Logistic Regression</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    selectedTxn.predicted_fraud_lr ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {selectedTxn.predicted_fraud_lr ? 'FRAUD' : 'LEGIT'}
                  </span>
                </div>

                {/* Random forest */}
                <div className="flex items-center justify-between p-2 border border-slate-100 rounded-lg">
                  <span className="text-slate-600">Random Forest</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    selectedTxn.predicted_fraud_rf ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {selectedTxn.predicted_fraud_rf ? 'FRAUD' : 'LEGIT'}
                  </span>
                </div>

                {/* XGBoost */}
                <div className="flex items-center justify-between p-2 border border-slate-100 rounded-lg">
                  <span className="text-slate-600">XGBoost</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    selectedTxn.predicted_fraud_xgb ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {selectedTxn.predicted_fraud_xgb ? 'FRAUD' : 'LEGIT'}
                  </span>
                </div>

                {/* Anomaly detector */}
                <div className="flex items-center justify-between p-2 border border-slate-100 rounded-lg">
                  <span className="text-slate-600">Isolation Forest</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    selectedTxn.predicted_fraud_iforest ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {selectedTxn.predicted_fraud_iforest ? 'ANOMALY' : 'NORMAL'}
                  </span>
                </div>
              </div>
            </div>

            {/* Extracted Flags */}
            {(selectedTxn.merchant_dest || selectedTxn.geo_mismatch || selectedTxn.velocity > 1) && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rule-Based Indicators</h4>
                <div className="space-y-1.5 text-[10px] font-bold">
                  {selectedTxn.geo_mismatch && (
                    <span className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-700 px-2.5 py-1.5 rounded-lg">
                      <AlertTriangle size={12} />
                      GEOLOCATION ANOMALY DETECTED
                    </span>
                  )}
                  {selectedTxn.velocity > 4 && (
                    <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-700 px-2.5 py-1.5 rounded-lg">
                      <TrendingUp size={12} />
                      VELOCITY WARNING (x{selectedTxn.velocity}/hr)
                    </span>
                  )}
                  {selectedTxn.merchant_dest && (
                    <span className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1.5 rounded-lg">
                      <ExternalLink size={12} />
                      MERCHANT ACCOUNT DESTINATION
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Drawer Audit Action Footer */}
          {selectedTxn.status === 'pending_review' && (
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center gap-3 shrink-0">
              <button 
                onClick={() => handleResolve(selectedTxn.id, 'cleared_legitimate')}
                className="flex-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <Check size={14} className="stroke-[2.5]" />
                Clear Legitimate
              </button>
              <button 
                onClick={() => handleResolve(selectedTxn.id, 'flagged_fraud')}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <X size={14} className="stroke-[2.5]" />
                Confirm Fraud
              </button>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
