"use client"
import React from 'react';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'stripe-pricing-table': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
        }
    }
}
export default function StripePricingTable() {

    return (
        <stripe-pricing-table
            pricing-table-id="prctbl_1UGAknGIHHpJQEluVOvnvQLI"
            publishable-key={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
        >
        </stripe-pricing-table>
    )


};
