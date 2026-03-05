'use client';
import { useAuth } from '@/components/Providers';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import Link from 'next/link';
import Image from 'next/image';
import styles from './Navbar.module.css';

export default function Navbar() {
    const { user } = useAuth();

    const handleLogin = async () => {
        const supabase = getSupabaseBrowser();
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    const handleLogout = async () => {
        const supabase = getSupabaseBrowser();
        await supabase.auth.signOut();
    };

    return (
        <nav className={styles.navbar} id="main-nav">
            <Link href="/" className={styles.navLogo}>
                <Image src="/logo.svg" alt="AdPilot" width={28} height={28} className={styles.logoIcon} />
                AdPilot
            </Link>

            <div className={styles.navLinks}>
                <Link href="/#workflow" className={styles.navLink}>工作流</Link>
                <Link href="/#features" className={styles.navLink}>功能</Link>
            </div>

            <div className={styles.navActions}>
                {user ? (
                    <>
                        <span className={styles.navUserName}>{user.user_metadata?.full_name || user.email}</span>
                        <button className={styles.navBtnSecondary} onClick={handleLogout}>退出</button>
                    </>
                ) : (
                    <button className={styles.navBtnSecondary} onClick={handleLogin}>登录</button>
                )}
                <Link href="/chat">
                    <button className={styles.navBtnPrimary}>开始分析</button>
                </Link>
            </div>
        </nav>
    );
}
