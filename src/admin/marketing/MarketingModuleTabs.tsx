import React from 'react';

export function MarketingModuleTabs({
  active,
  onNavigate,
}: {
  active: 'settings' | 'statistics';
  onNavigate: (path: string) => void;
}) {
  const tabs = [
    { key: 'settings' as const, label: '营销设置', path: '/admin/marketing-settings' },
    { key: 'statistics' as const, label: '营销统计', path: '/admin/marketing-statistics' },
  ];
  return (
    <div className="flex gap-6 border-b border-neutral-200" aria-label="营销模块页面">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`border-b-2 px-1 py-3 text-sm font-semibold transition ${
            active === tab.key
              ? 'border-neutral-950 text-neutral-950'
              : 'border-transparent text-neutral-500 hover:text-neutral-900'
          }`}
          aria-current={active === tab.key ? 'page' : undefined}
          onClick={() => onNavigate(tab.path)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
