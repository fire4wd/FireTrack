import React from 'react';

/**
 * Safely invokes .select() on an input or textarea element on focus or click.
 * Guards against non-input elements (e.g. <select>, <div>), date/time inputs,
 * and browsers/platforms where .select() may throw an error.
 */
export const safeSelect = (e: React.SyntheticEvent<any>) => {
  try {
    const target = e.currentTarget || e.target;
    if (target && typeof (target as any).select === 'function') {
      (target as any).select();
    }
  } catch {
    // Silently ignore if selection is unsupported on this element or platform
  }
};
