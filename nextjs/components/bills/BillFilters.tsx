'use client';

import { useState } from 'react';
import { FilterState, FilterOptions } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BillFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  options: FilterOptions;
  className?: string;
}

export default function BillFilters({
  filters,
  onChange,
  options,
  className,
}: BillFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const handleReset = () => {
    onChange({
      person: '',
      motive: '',
      category: '',
      role: '',
      type: '',
      dateFrom: '',
      dateTo: '',
      search: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  const filterContent = (
    <>
      {/* Search */}
      <div className="min-w-[200px] flex-1">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Search
        </label>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => handleChange('search', e.target.value)}
          placeholder="Vendor, item, comment..."
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors"
        />
      </div>

      {/* Person filter */}
      <div className="min-w-[150px] flex-1">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Person
        </label>
        <select
          value={filters.person}
          onChange={(e) => handleChange('person', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors bg-white"
        >
          <option value="">All Persons</option>
          {options.persons.map((person) => (
            <option key={person} value={person}>
              {person}
            </option>
          ))}
        </select>
      </div>

      {/* Motive filter */}
      <div className="min-w-[150px] flex-1">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Motive
        </label>
        <select
          value={filters.motive}
          onChange={(e) => handleChange('motive', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors bg-white"
        >
          <option value="">All Motives</option>
          {options.motives.map((motive) => (
            <option key={motive.id} value={motive.id}>
              {motive.name}
            </option>
          ))}
        </select>
      </div>

      {/* Category filter */}
      <div className="min-w-[150px] flex-1">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Category
        </label>
        <select
          value={filters.category}
          onChange={(e) => handleChange('category', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors bg-white"
        >
          <option value="">All Categories</option>
          {options.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* Role filter */}
      <div className="min-w-[120px] flex-1">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Role
        </label>
        <select
          value={filters.role}
          onChange={(e) => handleChange('role', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors bg-white"
        >
          <option value="">All Roles</option>
          {options.roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      {/* Type filter */}
      <div className="min-w-[120px] flex-1">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Type
        </label>
        <select
          value={filters.type}
          onChange={(e) => handleChange('type', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors bg-white"
        >
          <option value="">All Types</option>
          {options.types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className="min-w-[240px] flex-[2]">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Date Range
        </label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleChange('dateFrom', e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors"
          />
          <span className="text-slate-400">–</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleChange('dateTo', e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors"
          />
        </div>
      </div>
    </>
  );

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm p-4', className)}>
      {/* Mobile: Collapsible filters */}
      <div className="lg:hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-sm font-medium text-slate-700"
        >
          <span>Filters {hasActiveFilters && '•'}</span>
          <svg
            className={cn(
              'w-4 h-4 transition-transform',
              isExpanded && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isExpanded && (
          <div className="mt-4 flex flex-col gap-4 animate-[vb-rise_0.2s_ease-out]">
            {filterContent}
            {hasActiveFilters && (
              <button
                onClick={handleReset}
                className="self-start text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Reset all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Desktop: Always visible */}
      <div className="hidden lg:block">
        <div className="flex flex-wrap items-end gap-4">
          {filterContent}
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium px-3 py-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
