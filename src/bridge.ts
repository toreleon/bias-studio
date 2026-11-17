import { requireOptionalNativeModule } from "expo";

interface FanStickersModule {
  removeBackground(uri: string): Promise<string>;
  exportPack(payload: string): Promise<boolean>;
}
export const nativeBridge =
  requireOptionalNativeModule<FanStickersModule>("FanStickers");
