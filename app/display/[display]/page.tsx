import DisplayPage from "../../components/DisplayPage";

interface DisplayPageProps {
    params: Promise<{ display: string }>;
}

export default async function DisplayRoute({ params }: DisplayPageProps) {
    const { display } = await params;
    return <DisplayPage displayId={display} />;
}
