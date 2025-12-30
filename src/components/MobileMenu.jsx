import React from 'react';
import { X, Home, Zap, Shield, MessageSquare, Key, Menu as MenuIcon, BookOpen, HelpCircle, Info, Layers } from 'lucide-react';

export default function MobileMenu({ isOpen, onClose, currentView, isPro, onNavigate }) {
  if (!isOpen) return null;

  const menuItems = [
    ...(currentView === 'redactor' ? [
      { icon: Home, label: 'Home', action: 'home' }
    ] : []),
    ...(isPro ? [
      { icon: Zap, label: 'Batch Processing', action: 'batch' },
      { icon: MenuIcon, label: 'Custom Rules', action: 'rules' }
    ] : []),
    { icon: BookOpen, label: 'Blog & Guides', action: 'blog' },
    { icon: Layers, label: 'Case Studies', action: 'usecases' },
    { icon: HelpCircle, label: 'FAQ', action: 'faq' },
    { icon: Info, label: 'About', action: 'about' },
    { icon: Shield, label: 'Privacy', action: 'privacy' },
    { icon: MessageSquare, label: 'Feedback', action: 'feedback' },
    ...(!isPro ? [
      { icon: Key, label: 'Recover License', action: 'recover' }
    ] : [])
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Menu Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-72 bg-zinc-900 border-l border-zinc-800 z-50 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.action}
              onClick={() => {
                onNavigate(item.action);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-all group"
            >
              <item.icon className="w-5 h-5 text-zinc-500 group-hover:text-red-500 transition-colors" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Upgrade Button (if not Pro) */}
        {!isPro && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800 bg-zinc-900/80">
            <button
              onClick={() => {
                onNavigate('upgrade');
                onClose();
              }}
              className="w-full py-3 bg-white text-black font-semibold rounded-full hover:bg-zinc-200 transition-all"
            >
              Upgrade to Pro
            </button>
          </div>
        )}

        {/* Pro Badge (if Pro) */}
        {isPro && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800">
            <div className="flex items-center justify-center gap-2 py-2 bg-zinc-800 rounded-lg">
              <span className="text-xs font-bold text-white uppercase tracking-wider">PRO</span>
              <span className="text-xs text-zinc-400">All Features Unlocked</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
