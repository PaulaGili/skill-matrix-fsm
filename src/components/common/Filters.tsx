"use client";

import type { ReactNode } from "react";
import { FilterBar, FilterGroupItem, Icon, Input, MultiComboBox, MultiComboBoxItem } from "@ui5/webcomponents-react";
import shell from "./AppShell.module.css";

interface BarProps {
  active?: boolean; // a filter is set, so Clear is offered
  onClear?: () => void;
  children: ReactNode;
}

// The filter bar of every page: the same look, the same filter width, Clear only when it does something.
export function PageFilters({ active = false, onClear, children }: BarProps) {
  return (
    <FilterBar className={shell.filterBar} filterContainerWidth="14rem" hideFilterConfiguration hideToolbar showClearOnFB={active} onClear={onClear}>
      {children}
    </FilterBar>
  );
}

// The two filters below are functions and not components: the filter bar reads the props of
// its direct children, so each child has to be the FilterGroupItem itself.

interface SearchProps {
  filterKey: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export function searchFilter({ filterKey, label, placeholder, value, onChange }: SearchProps) {
  return (
    <FilterGroupItem key={filterKey} filterKey={filterKey} label={label} className={shell.filterItem}>
      <Input
        placeholder={placeholder}
        accessibleName={placeholder}
        showClearIcon
        icon={<Icon name="search" />}
        value={value}
        onInput={(event) => onChange(event.target.value)}
      />
    </FilterGroupItem>
  );
}

interface PickProps {
  filterKey: string;
  label: string;
  placeholder: string;
  help?: string;
  options: { key: string; text: string }[];
  selected: string[];
  onChange: (keys: string[]) => void;
}

// Several values can be picked. Without options the filter is not shown.
export function pickFilter({ filterKey, label, placeholder, help, options, selected, onChange }: PickProps) {
  return (
    <FilterGroupItem key={filterKey} filterKey={filterKey} label={label} className={shell.filterItem} hiddenInFilterBar={options.length === 0}>
      <MultiComboBox
        placeholder={placeholder}
        accessibleName={placeholder}
        title={help}
        onSelectionChange={(event) => onChange(event.detail.items.map((item) => item.dataset.key ?? ""))}
      >
        {options.map((option) => (
          <MultiComboBoxItem key={option.key} text={option.text} data-key={option.key} selected={selected.includes(option.key)} />
        ))}
      </MultiComboBox>
    </FilterGroupItem>
  );
}
