import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { BrainCircuit, Info, Award, BarChart3 } from 'lucide-react';

export default function ModelPerformance({ apiBase }) {
  const [metrics, setMetrics] = useState(null);
  const [importance, setImportance] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`${apiBase}/metrics`);
        if (response.ok) {
          const data = await response.json();
          setMetrics(data.metrics);
          
          // Format feature importance and sort descending
          const importanceData = Object.entries(data.feature_importance || {}).map(([key, val]) => ({
            name: key
              .replace('type_', 'Channel: ')
              .replace('old_balance_org', 'Origin Old Balance')
              .replace('new_balance_orig', 'Origin New Balance')
              .replace('old_balance_dest', 'Dest Old Balance')
              .replace('new_balance_dest', 'Dest New Balance')
              .replace('amount', 'Transaction Amount')
              .replace('merchant_dest', 'Merchant Destination')
              .replace('geo_mismatch', 'Geolocation Mismatch')
              .replace('velocity', 'Transaction Velocity'),
            importance: val
          }));
          importanceData.sort((a, b) => b.importance - a.importance);
          setImportance(importanceData);
        } else {
          setError("Failed to fetch model metrics from API.");
        }
      } catch (e) {
        setError("Could not connect to API server to retrieve metrics.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMetrics();
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-20 text-slate-400 font-semibold">
        Calculating classifier metrics and loading models weights...
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="max-w-md mx-auto text-center py-20 text-xs font-semibold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl p-6">
        {error || "Models have not been trained yet. Stream transactions or execute a bulk scan to train them."}
      </div>
    );
  }

  // Prep data for comparison charts
  const metricKeys = ["accuracy", "precision", "recall", "f1_score", "roc_auc"];
  const modelNames = Object.keys(metrics);
  
  // Create a structured list comparing a specific metric across models
  const getMetricComparison = (metricName) => {
    return modelNames.map(model => ({
      name: model.replace(' Classifier', ''),
      value: parseFloat((metrics[model][metricName] * 100).toFixed(1))
    }));
  };

  const chartColors = ['#6366f1', '#3b82f6', '#14b8a6', '#f59e0b'];

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Overview stats info */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-start gap-4">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
          <BrainCircuit size={22} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 text-[15px]">Ensemble Model Classification Panel</h3>
          <p className="text-xs text-slate-500 mt-1">
            Evaluate performance metrics for all four classifiers. The system combines tree architectures (XGBoost, Random Forest), linear models (Logistic Regression), and unsupervised estimators (Isolation Forest) to achieve high sensitivity and low false positive rates.
          </p>
        </div>
      </section>

      {/* Grid of Model Cards with Details & Confusion Matrix */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {modelNames.map((model, idx) => {
          const m = metrics[model];
          // confusion matrix: [[tn, fp], [fn, tp]]
          const [tn, fp] = m.confusion_matrix[0] || [0, 0];
          const [fn, tp] = m.confusion_matrix[1] || [0, 0];
          
          return (
            <div key={model} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Classifier {idx + 1}</span>
                <h4 className="font-bold text-slate-800 text-[14px] mt-0.5 block">{model}</h4>
              </div>
              
              {/* Primary performance metrics */}
              <div className="grid grid-cols-2 gap-3.5 my-5 text-center">
                <div className="border border-slate-100 rounded-lg p-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">F1-Score</span>
                  <span className="text-sm font-bold text-slate-800 mt-0.5 block">{(m.f1_score * 100).toFixed(1)}%</span>
                </div>
                <div className="border border-slate-100 rounded-lg p-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">ROC-AUC</span>
                  <span className="text-sm font-bold text-slate-800 mt-0.5 block">{(m.roc_auc * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* Confusion Matrix Visual grid */}
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Confusion Matrix</span>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-center font-bold">
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-100/50 p-1.5 rounded" title="True Negatives">
                    <span className="text-[8px] font-bold block text-emerald-500 uppercase">TN</span>
                    {tn.toLocaleString()}
                  </div>
                  <div className="bg-rose-50/50 text-rose-800 border border-rose-100/40 p-1.5 rounded" title="False Positives">
                    <span className="text-[8px] font-bold block text-rose-400 uppercase">FP</span>
                    {fp.toLocaleString()}
                  </div>
                  <div className="bg-rose-50/50 text-rose-800 border border-rose-100/40 p-1.5 rounded" title="False Negatives">
                    <span className="text-[8px] font-bold block text-rose-400 uppercase">FN</span>
                    {fn.toLocaleString()}
                  </div>
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-100/50 p-1.5 rounded" title="True Positives">
                    <span className="text-[8px] font-bold block text-emerald-500 uppercase">TP</span>
                    {tp.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Row containing Metrics Comparison charts and Feature Importances */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Comparative Metric Bar charts */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} className="text-indigo-600" />
            <h4 className="font-semibold text-slate-800 text-sm">Key Evaluation Comparisons</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 flex-1">
            {/* Recall graph (vital to capture fraud) */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sensitivity / Recall (%)</span>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getMetricComparison('recall')} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {getMetricComparison('recall').map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Precision graph */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Precision / Positive Predictive Value (%)</span>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getMetricComparison('precision')} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {getMetricComparison('precision').map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Importance horizontal bar chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-indigo-600" />
            <h4 className="font-semibold text-slate-800 text-sm">Feature Importances</h4>
          </div>
          
          <div className="h-64 w-full flex-1 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={importance.slice(0, 7)}
                margin={{ top: 0, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={8} width={90} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: '10px' }} />
                <Bar dataKey="importance" fill="#6366f1" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <span className="text-[9px] text-slate-400 font-bold block text-center uppercase border-t border-slate-100 pt-3">
            Extracted from Random Forest & XGBoost averages
          </span>
        </div>
      </section>
    </div>
  );
}
