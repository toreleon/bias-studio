export async function sharePackFile(bytes: Uint8Array, id: string) {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/zip" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `bias-studio-${id}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function pickPackFile(): Promise<Uint8Array | null> {
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!file) return null;
  if (file.size > 32 * 1024 * 1024)
    throw new Error("Choose a Bias Studio ZIP smaller than 32 MB.");
  return new Uint8Array(await file.arrayBuffer());
}
