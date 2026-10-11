import { redirect } from "next/navigation";

export default async function BotIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/bots/${id}/knowledge`);
}
