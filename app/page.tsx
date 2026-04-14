import Link from "next/link";

export default function Home() {
    return (
        <main className="home-page">
            <div className="home-hero">
                <h1 className="home-title">Infoscreen<span>4</span></h1>
                <p className="home-subtitle">Digital signage for LAN parties and events</p>
                <div className="home-actions">
                    <Link href="/display" className="home-btn home-btn-primary">Display</Link>
                    <Link href="/admin" className="home-btn home-btn-secondary">Admin</Link>
                </div>
            </div>
        </main>
    );
}
