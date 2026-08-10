export const SUPPORTED_LOCALES = ['ja', 'ko', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ja';

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export interface Messages {
  appTitle: string;
  disclaimer: string;
  languageSelectorLabel: string;
  localeName: Record<Locale, string>;
  hullCtaLabel: string;
  hullCtaExternalNotice: string;

  editorTemplateLabel: string;
  editorTemplateWallLed: string;
  editorTemplateStandDisplay: string;
  editorAddTextButton: string;
  editorAddImageButton: string;
  editorDeleteButton: string;
  editorUndoButton: string;
  editorRedoButton: string;
  editorExportButton: string;
  editorBackgroundColorLabel: string;
  editorEmptyCanvasHint: string;
  editorPropertiesTitle: string;
  editorPropertiesEmptyHint: string;
  editorPositionXLabel: string;
  editorPositionYLabel: string;
  editorWidthLabel: string;
  editorHeightLabel: string;
  editorRotationLabel: string;
  editorTextContentLabel: string;
  editorFontSizeLabel: string;
  editorTextColorLabel: string;
  editorTextAlignLabel: string;
  editorAlignLeft: string;
  editorAlignCenter: string;
  editorAlignRight: string;
  editorImageUploadErrorUnsupportedType: string;
  editorImageUploadErrorTooLarge: string;
  editorImageUploadErrorDecodeFailed: string;
  editorExportedAnnouncement: string;
  editorExportErrorAnnouncement: string;

  editorSpaceBackgroundLabel: string;
  editorAddSpaceBackgroundButton: string;
  editorRemoveSpaceBackgroundButton: string;
  editorAddWallLedButton: string;
  editorAddStandDisplayButton: string;

  editorContentLabel: string;
  editorContentUploadButton: string;
  editorContentReplaceButton: string;
  editorContentRemoveButton: string;
  editorContentNoneHint: string;
  editorContentFitLabel: string;
  editorContentFitContain: string;
  editorContentFitCover: string;
  editorContentOffsetXLabel: string;
  editorContentOffsetYLabel: string;
  editorContentScaleLabel: string;
  editorContentResetButton: string;

  editorMaterialLabel: string;
  editorMaterialOutdoorLed: string;
  editorMaterialLcd: string;
  editorMaterialIntensityLabel: string;
  editorMaterialBrightnessLabel: string;
  editorMaterialResetButton: string;
  editorMaterialPreviewNotice: string;
}
