import FabricEditor from "../../components/FabricEditor";

export const metadata = {
    title: "Slide Editor — Infoscreen4",
};

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ bundle?: string; slide?: string }> }) {
    const { bundle, slide } = await searchParams;
    return <FabricEditor initialBundle={bundle} initialSlide={slide} />;
}
