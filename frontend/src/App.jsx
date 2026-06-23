import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Database, 
  LayoutDashboard, 
  ListOrdered, 
  UploadCloud, 
  BrainCircuit, 
  Settings, 
  CheckCircle, 
  XCircle,
  Menu,
  Bell
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import TransactionsTable from './components/TransactionsTable';
import BatchUpload from './components/BatchUpload';
import ModelPerformance from './components/ModelPerformance';

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin + '/api';
const WS_BASE = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/api/stream/ws';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [apiConnected, setApiConnected] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    total_transactions: 0,
    flagged_count: 0,
    cleared_count: 0,
    pending_count: 0,
    fraud_rate: 0,
    total_amount: 0,
    avg_risk_score: 0,
    daily_stats: [],
    type_stats: {},
    risk_distribution: {}
  });
  
  const [newTxnAlert, setNewTxnAlert] = useState(null);
  const wsRef = useRef(null);

  // Poll server to check API health
  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/dashboard-stats`);
      if (response.ok) {
        setApiConnected(true);
        const data = await response.json();
        setStats(data);
      } else {
        setApiConnected(false);
      }
    } catch (e) {
      setApiConnected(false);
    }
  };

  // Fetch initial transactions list
  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${API_BASE}/transactions?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (e) {
      console.error("Failed to fetch transactions:", e);
    }
  };

  useEffect(() => {
    checkApiHealth();
    fetchTransactions();
    
    // Poll API health & stats every 8 seconds
    const interval = setInterval(() => {
      checkApiHealth();
    }, 8000);
    
    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Connect WebSocket for real-time streaming
  useEffect(() => {
    let ws;
    
    const connectWS = () => {
      console.log("Connecting to WebSocket...");
      ws = new WebSocket(WS_BASE);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log("WebSocket connected.");
        setStreamActive(true);
      };
      
      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === 'NEW_TRANSACTION') {
          const newTxn = payload.data;
          
          // Prepend new transaction
          setTransactions(prev => [newTxn, ...prev.slice(0, 99)]);
          
          // Trigger alert banner if high risk
          if (newTxn.risk_score >= 0.7) {
            setNewTxnAlert(newTxn);
            // Auto dismiss alert after 5 seconds
            setTimeout(() => {
              setNewTxnAlert(null);
            }, 6000);
          }
          
          // Live recalculate summary stats locally to avoid laggy REST API fetches
          setStats(prev => {
            const total = prev.total_transactions + 1;
            const flagged = prev.flagged_count + (newTxn.status === 'flagged_fraud' ? 1 : 0);
            const cleared = prev.cleared_count + (newTxn.status === 'cleared_legitimate' ? 1 : 0);
            const pending = prev.pending_count + (newTxn.status === 'pending_review' ? 1 : 0);
            const fraudRate = (flagged / total) * 100;
            const newTotalAmount = prev.total_amount + newTxn.amount;
            const newAvgRisk = (prev.avg_risk_score * prev.total_transactions + newTxn.risk_score) / total;
            
            // Increment type counts
            const typeStats = { ...prev.type_stats };
            typeStats[newTxn.type] = (typeStats[newTxn.type] || 0) + 1;
            
            // Increment risk distribution
            const riskDist = { ...prev.risk_distribution };
            let riskBucket = "Low Risk";
            if (newTxn.risk_score >= 0.7) riskBucket = "High Risk";
            else if (newTxn.risk_score >= 0.3) riskBucket = "Medium Risk";
            riskDist[riskBucket] = (riskDist[riskBucket] || 0) + 1;
            
            return {
              ...prev,
              total_transactions: total,
              flagged_count: flagged,
              cleared_count: cleared,
              pending_count: pending,
              fraud_rate: parseFloat(fraudRate.toFixed(2)),
              total_amount: parseFloat(newTotalAmount.toFixed(2)),
              avg_risk_score: parseFloat(newAvgRisk.toFixed(4)),
              type_stats: typeStats,
              risk_distribution: riskDist
            };
          });
        }
      };
      
      ws.onclose = () => {
        console.log("WebSocket disconnected.");
        setStreamActive(false);
        // Retry connection in 3 seconds if streamer was active
        setTimeout(connectWS, 3000);
      };
      
      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.close();
      };
    };
    
    connectWS();
    
    return () => {
      if (ws) ws.close();
    };
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <ShieldAlert size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 leading-none text-[15px]">ShieldFraud AI</h1>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Risk Engine</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            <LayoutDashboard size={18} />
            Overview Dashboard
          </button>
          
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'transactions' 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            <ListOrdered size={18} />
            Transactions Ledger
          </button>
          
          <button 
            onClick={() => setActiveTab('batch')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'batch' 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            <UploadCloud size={18} />
            Bulk Scan (CSV)
          </button>
          
          <button 
            onClick={() => setActiveTab('performance')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'performance' 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            <BrainCircuit size={18} />
            Model Performance
          </button>
        </nav>
        
        {/* Connection Status Footprint */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <Activity size={13} className={apiConnected ? "text-green-500 animate-pulse" : "text-red-400"} />
              API Server
            </span>
            <span className={apiConnected ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
              {apiConnected ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <Database size={13} className="text-slate-400" />
              Database
            </span>
            <span className="text-slate-600 font-semibold uppercase">
              SQLite (Local)
            </span>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Header bar */}
        <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-slate-800 text-lg">
              {activeTab === 'dashboard' && 'Risk Operations Center'}
              {activeTab === 'transactions' && 'Historical Ledger'}
              {activeTab === 'batch' && 'Batch Transaction Scanning'}
              {activeTab === 'performance' && 'ML Model Analytics'}
            </h2>
            {streamActive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Stream Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Quick stats indicator */}
            <div className="text-right text-xs">
              <div className="text-slate-400 font-medium">Critical Fraud Rate</div>
              <div className="font-bold text-slate-800 text-sm">
                {stats.fraud_rate}%
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors relative">
              <Bell size={20} />
              {stats.pending_count > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>
          </div>
        </header>

        {/* Dynamic Toast for real-time Fraud Detections */}
        {newTxnAlert && (
          <div className="absolute bottom-5 right-5 w-96 bg-white border-l-4 border-rose-500 rounded-lg shadow-xl p-4 flex gap-3 animate-bounce z-50">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-full h-fit">
              <ShieldAlert size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-slate-900">Critical Anomaly Blocked</h4>
                <span className="text-[10px] text-slate-400 font-semibold">Live</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Transaction from {newTxnAlert.origin_id} flagged by AI with <b>{(newTxnAlert.risk_score * 100).toFixed(0)}%</b> fraud risk score.
              </p>
              <div className="flex items-center justify-between mt-2.5">
                <span className="text-xs font-bold text-slate-800">₹{newTxnAlert.amount.toLocaleString('en-IN')}</span>
                <button 
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  View Details &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-8 min-h-0">
          {activeTab === 'dashboard' && (
            <Dashboard 
              stats={stats} 
              transactions={transactions} 
              apiBase={API_BASE} 
              onStatsRefresh={checkApiHealth}
            />
          )}
          {activeTab === 'transactions' && (
            <TransactionsTable 
              apiBase={API_BASE} 
              onAuditUpdate={checkApiHealth}
            />
          )}
          {activeTab === 'batch' && (
            <BatchUpload 
              apiBase={API_BASE} 
              onUploadSuccess={() => {
                checkApiHealth();
                fetchTransactions();
              }}
            />
          )}
          {activeTab === 'performance' && (
            <ModelPerformance 
              apiBase={API_BASE} 
            />
          )}
        </div>
      </main>
    </div>
  );
}
