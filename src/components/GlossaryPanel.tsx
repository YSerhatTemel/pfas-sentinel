import React from 'react';
import { BookOpen, X } from 'lucide-react';
import { GLOSSARY } from '../data/glossary';

interface GlossaryPanelProps {
  onClose: () => void;
}

export const GlossaryPanel: React.FC<GlossaryPanelProps> = ({ onClose }) => (
  <div className="bg-[#0B1D30] border border-cyan-500/40 rounded-xl p-5 mb-6">
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4" />
          Key Terms, Explained
        </span>
        <h2 className="text-base font-bold text-white mt-0.5">
          What each technical term means — and why it matters for PFAS-Sentinel
        </h2>
      </div>
      <button
        onClick={onClose}
        aria-label="Close key terms"
        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#10263F] border border-slate-800"
      >
        <X className="w-4 h-4" />
      </button>
    </div>

    <div className="space-y-5">
      {GLOSSARY.map((group) => (
        <div key={group.group}>
          <h3 className="text-xs font-mono uppercase text-amber-300 mb-2">{group.group}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.terms.map((t) => (
              <div key={t.term} className="bg-[#061320] border border-slate-800 rounded-lg p-3 space-y-1.5">
                <h4 className="text-xs font-bold text-cyan-300">{t.term}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{t.meaning}</p>
                <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                  <strong className="text-emerald-300">Why it matters:</strong> {t.whyItMatters}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);
