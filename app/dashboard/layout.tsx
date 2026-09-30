
import DashboardHeader from "@/components/DashboardHeader";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/utils/db/db";
import { usersTable } from "@/utils/db/schema";
import { eq } from "drizzle-orm";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "SAAS Starter Kit",
    description: "SAAS Starter Kit with Stripe, Supabase, Postgres",
};

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const supabase = createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const userEmail = user.email;

    if (!userEmail) {
        redirect("/login");
    }

    // Temporary development access for Jaemin.
    const isJaemin = userEmail === "jaemin@jaeminfrazer.com";

    if (!isJaemin) {
        const checkUserInDB = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, userEmail));

        const dbUser = checkUserInDB[0];

        if (!dbUser) {
            console.log("User not found in database");
            redirect("/subscribe");
        }

        const hasSubscription = dbUser.plan !== "none";

        const hasActiveBetaAccess =
            dbUser.beta_access_expires_at !== null &&
            dbUser.beta_access_expires_at !== undefined &&
            dbUser.beta_access_expires_at.getTime() > Date.now();

        if (!hasSubscription && !hasActiveBetaAccess) {
            console.log("User has no active subscription or beta access");
            redirect("/subscribe");
        }
    }

    return (
        <html lang="en">
            <DashboardHeader />
            {children}
        </html>
    );
}
