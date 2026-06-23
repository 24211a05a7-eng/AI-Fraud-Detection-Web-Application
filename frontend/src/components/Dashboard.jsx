import React, { useState } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar,
  Legend
} from 'recharts';
import { 
  Activity, 
  DollarSign, 
  ShieldAlert, 
  Layers, 
  Play, 
  Square, 
  Clock, 
  Check, 
  X,
  MapPin,
  TrendingUp
} from 'lucide-react';

export default function Dashboard({ stats, transactions, apiBase, onStatsRefresh }) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [fraudRate, setFraudRate] = useState(0.08);
  const [submittingActionId, setSubmittingActionId] = useState(null);

  // Toggle Stream Simulator
  const handleToggleSimulator = async () => {
    if (isSimulating) {
      try {
        const response = await fetch(`${apiBase}/stream/stop`, { method: 'POST' });
        if (response.ok) {
          setIsSimulating(false);
        }
      } catch (e) {
        console.error("Failed to stop simulation:", e);
      }
    } else {
      try {
        const response = await fetch(`${apiBase}/stream/start?delay=${speed}&fraud_rate=${fraudRate}`, { 
          method: 'POST' 
        });
        if (response.ok) {
          setIsSimulating(true);
        }
      } catch (e) {
        console.error("Failed to start simulation:", e);
      }
    }
  };

  // Perform quick resolution (Confirm Fraud / Clear Legitimate)
  const handleResolveTransaction = async (txnId, newStatus) => {
    setSubmittingActionId(txnId);
    try {
      const response = await fetch(`${apiBase}/transactions/${txnId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        // Refresh dashboard metrics
        onStatsRefresh();
      }
    } catch (e) {
      console.error("Failed to update status:", e);
    } finally {
      setSubmittingActionId(null);
    }
  };

  // Format big numbers in Indian formats (Lakhs/Crores)
  const formatCurrency = (value) => {
    if (value >= 1.0e7) return `₹${(value / 1.0e7).toFixed(1)}Cr`;
    if (value >= 1.0e5) return `₹${(value / 1.0e5).toFixed(1)}L`;
    if (value >= 1.0e3) return `₹${(value / 1.0e3).toFixed(1)}K`;
    return `₹${value.toFixed(2)}`;
  };

  // Pre-configured colors for charts
  const COLORS = {
    legit: '#6366f1',  // indigo-500
    fraud: '#f43f5e',  // rose-500
    pending: '#f59e0b',// amber-500
    low: '#10b981',    // emerald-500
    med: '#f59e0b',    // amber-500
    high: '#f43f5e',   // rose-500
    types: ['#6366f1', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899']
  };

  // Prep data for Risk Distribution Pie
  const pieData = Object.entries(stats.risk_distribution || {}).map(([key, val]) => ({
    name: key,
    value: val
  }));

  // Prep data for Transaction Type Bar
  const barData = Object.entries(stats.type_stats || {}).map(([key, val]) => ({
    name: key,
    volume: val
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Simulation Controls Widget */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800 text-[15px]">Real-Time Streaming Simulator</h3>
            <span className={`w-2 h-2 rounded-full ${isSimulating ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Toggle the automatic ingestion system to stream randomized transactions and evaluate model inference in real-time.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Rate Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inflow Speed</label>
            <select 
              disabled={isSimulating}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:opacity-60"
            >
              <option value={3.0}>Slow (3.0s)</option>
              <option value={1.0}>Normal (1.0s)</option>
              <option value={0.3}>Fast (0.3s)</option>
            </select>
          </div>

          {/* Fraud slider */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simulated Fraud Rate</label>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min="0.01" 
                max="0.40" 
                step="0.01"
                disabled={isSimulating}
                value={fraudRate}
                onChange={(e) => setFraudRate(parseFloat(e.target.value))}
                className="w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-60"
              />
              <span className="text-xs font-semibold text-slate-600 w-8">{(fraudRate * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Start/Stop Button */}
          <button
            onClick={handleToggleSimulator}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm ${
              isSimulating 
                ? 'bg-rose-500 hover:bg-rose-600 text-white' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isSimulating ? (
              <>
                <Square size={13} className="fill-white" />
                Stop Streaming
              </>
            ) : (
              <>
                <Play size={13} className="fill-white" />
                Start Streaming
              </>
            )}
          </button>
        </div>
      </section>

      {/* KPI Stats Cards Block */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total volume */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Activity size={22} />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Total Scanned</span>
            <span className="text-xl font-bold text-slate-800 mt-0.5 block">{stats.total_transactions.toLocaleString()}</span>
            <span className="text-[10px] font-semibold text-slate-400 mt-1 block">All history</span>
          </div>
        </div>

        {/* Currency volume */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <DollarSign size={22} />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Monitored Amount</span>
            <span className="text-xl font-bold text-slate-800 mt-0.5 block">{formatCurrency(stats.total_amount)}</span>
            <span className="text-[10px] font-semibold text-slate-400 mt-1 block">Simulated volume</span>
          </div>
        </div>

        {/* Fraud rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <ShieldAlert size={22} />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Confirmed Fraud Rate</span>
            <span className="text-xl font-bold text-rose-600 mt-0.5 block">{stats.fraud_rate}%</span>
            <span className="text-[10px] font-semibold text-rose-400 mt-1 block">{stats.flagged_count} flagged cases</span>
          </div>
        </div>

        {/* Pending Cases */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Layers size={22} />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Queue Audits</span>
            <span className={`text-xl font-bold mt-0.5 block ${stats.pending_count > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {stats.pending_count}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 mt-1 block">Awaiting resolution</span>
          </div>
        </div>
      </section>

      {/* Analytics Charts Panel */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Line Area Graph - 15 Day Trends */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-slate-800 text-sm">Security Ingestion Trends</h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Daily volume and flagged fraud distribution</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" />
                Scanned
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm" />
                Fraud Flagged
              </span>
            </div>
          </div>
          <div className="h-72 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.daily_stats || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.legit} stopOpacity={0.12}/>
                    <stop offset="95%" stopColor={COLORS.legit} stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorFraud" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.fraud} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={COLORS.fraud} stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} 
                />
                <Area type="monotone" dataKey="total_count" name="Total Ingested" stroke={COLORS.legit} strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                <Area type="monotone" dataKey="fraud_count" name="Fraud Blocked" stroke={COLORS.fraud} strokeWidth={2} fillOpacity={1} fill="url(#colorFraud)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Graph - Risk Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-slate-800 text-sm">Security Risk Profiling</h4>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Ensemble classification distribution</p>
          </div>
          
          <div className="h-44 w-full flex justify-center items-center my-4 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  <Cell fill={COLORS.low} />
                  <Cell fill={COLORS.med} />
                  <Cell fill={COLORS.high} />
                </Pie>
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center rate indicator */}
            <div className="absolute text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Risk Threat</span>
              <span className="text-xl font-bold text-slate-800 block">
                {((stats.risk_distribution["High Risk"] / (stats.total_transactions || 1)) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs font-semibold">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Low Risk (&lt;0.3)
              </span>
              <span className="text-slate-800">{stats.risk_distribution["Low Risk"] || 0}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Medium Risk (0.3 - 0.7)
              </span>
              <span className="text-slate-800">{stats.risk_distribution["Medium Risk"] || 0}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                High Risk (&ge;0.7)
              </span>
              <span className="text-slate-800 text-rose-600">{stats.risk_distribution["High Risk"] || 0}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Row containing live transaction feed and transactional type distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Live transaction feed */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-slate-800 text-sm">Real-Time Ingestion Logs</h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Showing latest streaming records and audit actions</p>
            </div>
            <div className="text-xs text-slate-400 font-semibold">
              Live updates via websocket
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-96 flex-1 space-y-3 pr-1">
            {transactions.slice(0, 8).map((txn) => {
              const isHighRisk = txn.risk_score >= 0.7;
              const isPending = txn.status === 'pending_review';
              
              // Custom class to highlight recently added rows
              const isRecent = isSimulating && (new Date() - new Date(txn.timestamp) < 4000);
              
              return (
                <div 
                  key={txn.id} 
                  className={`border rounded-lg p-3.5 transition-all flex items-center justify-between gap-4 ${
                    isRecent ? 'animate-pulse-once' : 'bg-white border-slate-200'
                  } ${isHighRisk ? 'border-l-4 border-l-rose-500 bg-rose-25/30' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Risk Badge icon */}
                    <div className={`p-2 rounded-full shrink-0 ${
                      isHighRisk 
                        ? 'bg-rose-50 text-rose-500' 
                        : isPending 
                          ? 'bg-amber-50 text-amber-500' 
                          : 'bg-indigo-50 text-indigo-500'
                    }`}>
                      <ShieldAlert size={16} />
                    </div>
                    
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{txn.type}</span>
                        <span className="text-[10px] font-semibold text-slate-400">{txn.origin_id} &rarr; {txn.dest_id}</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 font-semibold mt-1">
                        <span className="flex items-center gap-0.5">
                          <MapPin size={10} />
                          {txn.location}
                        </span>
                        <span>•</span>
                        <span>Risk: {(txn.risk_score * 100).toFixed(0)}%</span>
                        {txn.geo_mismatch && (
                          <>
                            <span>•</span>
                            <span className="text-rose-500 font-bold uppercase">Geo Mismatch</span>
                          </>
                        )}
                        {txn.velocity > 4 && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 font-bold uppercase">Velocity x{txn.velocity}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-sm font-bold text-slate-800">₹{txn.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                    
                    {/* Operational audit buttons */}
                    {txn.status === 'pending_review' || txn.status === 'flagged_fraud' ? (
                      <div className="flex items-center gap-1">
                        <button
                          disabled={submittingActionId === txn.id}
                          onClick={() => handleResolveTransaction(txn.id, 'cleared_legitimate')}
                          title="Dismiss / Clear as legitimate"
                          className="p-1 rounded bg-slate-100 hover:bg-green-50 hover:text-green-600 text-slate-500 border border-slate-200 transition-colors disabled:opacity-50"
                        >
                          <Check size={14} className="stroke-[2.5]" />
                        </button>
                        {txn.status !== 'flagged_fraud' && (
                          <button
                            disabled={submittingActionId === txn.id}
                            onClick={() => handleResolveTransaction(txn.id, 'flagged_fraud')}
                            title="Escalate / Confirm Fraud"
                            className="p-1 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 border border-slate-200 transition-colors disabled:opacity-50"
                          >
                            <X size={14} className="stroke-[2.5]" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 rounded">
                        CLEARED
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            
            {transactions.length === 0 && (
              <div className="text-center py-10 text-xs font-semibold text-slate-400 border border-dashed rounded-lg border-slate-200">
                No active records. Start streaming or check DB connection.
              </div>
            )}
          </div>
        </div>

        {/* Transaction type distribution chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-slate-800 text-sm">Channel Distribution</h4>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Ingested records classified by payment method</p>
          </div>
          
          <div className="h-60 w-full flex-1 my-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
                <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.types[index % COLORS.types.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] text-slate-500 font-bold tracking-wide uppercase text-center border-t border-slate-100 pt-3">
            Payments and cash-outs represent major vectors
          </div>
        </div>
      </section>
    </div>
  );
}
