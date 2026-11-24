// Minimal stand-ins for the @instinct/files UI kit that the source imports but does not ship.
// They emit the class names the source stylesheet already targets (file-card, file-group,
// file-group-heading) plus a few structural classes styled in shim.css.
import React from 'react';

export function FileRouter({ children }: any) { return <>{children}</>; }

export function FileCard({ children }: any) { return <div className="file-card">{children}</div>; }

export function Group({ label, heading, children }: any) {
    return (
        <section className="file-group" aria-label={label && !heading ? label : undefined}>
            {label && heading && <h2 className="file-group-heading">{label}</h2>}
            {children}
        </section>
    );
}

export function Text({ children }: any) { return <div className="file-text">{children}</div>; }
export function Paragraph({ children }: any) { return <p className="file-paragraph">{children}</p>; }
export function Caption({ children }: any) { return <p className="file-caption">{children}</p>; }

export function TextLink({ href, children }: any) {
    return <a className="file-textlink" href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export function Rows({ children }: any) { return <div className="file-rows" role="list">{children}</div>; }

export function Row({ number, name, detail }: any) {
    return (
        <div className="file-row" role="listitem">
            {number !== undefined && <span className="file-row-num">{number}.</span>}
            <span className="file-row-body">
                <span className="file-row-name">{name}</span>
                {detail && <span className="file-row-detail">{detail}</span>}
            </span>
        </div>
    );
}
