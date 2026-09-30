
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
    const isJaemin = userEmail.toLowerCase() === "jaemin@jaeminfrazer.com";

    if (!isJaemin) {
        const checkUserInDB = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, userEmail.toLowerCase()))
            .limit(1);

        const dbUser = checkUserInDB[0];

        const hasActiveBetaAccess =
            !!dbUser?.beta_access_expires_at &&
            new Date(dbUser.beta_access_expires_at) > new Date();

        const hasSubscription = !!dbUser && dbUser.plan !== "none";

        if (!dbUser || (!hasSubscription && !hasActiveBetaAccess)) {
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
