// @zuccadev-labs/zuix-zui/dom/media — Carousel, CompareSlider, ImageCropper, QRCode, SignaturePad, CircularSlider,
// ShortcutInput, Confetti y DownloadTrigger con origen remoto, sin framework. Registro: init(mediaModule) o
// use(mediaModule) junto a @zuccadev-labs/zuix-zui/dom/core.
import * as carousel from "../carousel";
import * as media from "../media";
import type { DomModule } from "../shared";

export { carousel, type CarouselHandle, type CarouselOptions, type CarouselRasterSize, type CarouselRasterSource } from "../carousel";
export { setCompareValue } from "../media";
export { qrcodeSvg } from "../../core/qr-widget";
export { confetti, type ConfettiOptions } from "../../core/confetti-runtime";
export { signatureBlob, signatureValue, type SignatureValue } from "../../core/signature-widget";
export { cropImage, cropImageBlob, type CropImageOptions } from "../../core/crop-image";
export { destroyWidget, setWidgetProps } from "../widgets";

export const mediaModule: DomModule = {
  name: "media",
  parts: [
    { rank: 40, setup: carousel.setup, hydrate: carousel.hydrate },
    { rank: 44, setup: media.setup, hydrate: media.hydrate },
    media.mediaWidgets,
  ],
};
