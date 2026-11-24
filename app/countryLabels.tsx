import React from 'react';

// Presentation only. Country names remain the stable keys in every data source.
export const COUNTRY_CODES: Record<string, string> = {
    'New Zealand': 'NZ', Australia: 'AUS', India: 'IND', 'West Indies': 'WI',
    'Sri Lanka': 'SL', Pakistan: 'PAK', Bangladesh: 'BD', 'South Africa': 'SA', England: 'ENG', Zimbabwe: 'ZIM', Afghanistan: 'AFG', Ireland: 'IRE',
};
const countryPattern = /\b(New Zealand|Australia|India|West Indies|Sri Lanka|Pakistan|Bangladesh|South Africa|England|Zimbabwe|Afghanistan|Ireland)\b/g;
export function displayText(text: string, heading = false): string {
    const comparison = text.replace(/\b(?:versus|vs|v)\b/gi, 'Vs');
    return heading ? comparison : comparison.replace(countryPattern, (name) => COUNTRY_CODES[name]);
}

// Apply to rendered text, never to data keys, event handlers, filter values or URLs.
// Table column labels are compact labels; section/scorecard headings stay in full.
export function countryView(node: any, inheritedHeading = false): any {
    if (typeof node === 'string') return displayText(node, inheritedHeading);
    if (Array.isArray(node)) return node.map((child) => countryView(child, inheritedHeading));
    if (!React.isValidElement(node)) return node;
    const element = node as React.ReactElement<any>;
    const props = element.props;
    const className = typeof props.className === 'string' ? props.className : '';
    const heading = inheritedHeading || (typeof element.type === 'string' && /^h[1-6]$/.test(element.type)) ||
        /(?:^|\s)crx-(?:filterlabel|sctitle|scinnhead|colltitle|sheettitle|profile-scope)(?:\s|$)/.test(className);
    const next: Record<string, any> = {};
    if (props.children !== undefined) next.children = countryView(props.children, heading);
    for (const key of ['aria-label', 'alt', 'title']) {
        if (typeof props[key] === 'string') next[key] = displayText(props[key], heading);
    }
    // Kit rows render these fields internally; they are display content, not keys.
    if (typeof element.type !== 'string') {
        for (const key of ['name', 'detail']) {
            if (props[key] !== undefined) next[key] = countryView(props[key], heading);
        }
    }
    return React.cloneElement(element, next);
}
