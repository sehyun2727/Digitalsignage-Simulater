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

  editorTemplateSectionHeading: string;
  portableSectionHeading: string;
  editorAddPortableButton: string;
  portableTypeLabel: string;
  portableTypeValue: string;

  portableBackgroundNotice: string;
  portableRightsNotice: string;
  portableSupportedFormatsHint: string;

  portableStepSelectPhotoTitle: string;
  portableStepDefineRegionTitle: string;
  portableSelectPhotoButton: string;
  portableChangePhotoButton: string;
  portableNoPhotoSelectedHint: string;

  portableScreenRegionDragHint: string;
  portableScreenRegionMoveResizeHint: string;
  portableScreenRegionXLabel: string;
  portableScreenRegionYLabel: string;
  portableScreenRegionWidthLabel: string;
  portableScreenRegionHeightLabel: string;
  portableScreenRegionResetButton: string;
  portableScreenRegionEditButton: string;
  portableScreenRegionMinSizeError: string;

  portableCancelButton: string;
  portableBackButton: string;
  portableNextButton: string;
  portableAddButton: string;
  portableSaveButton: string;
  portableReplacePhotoHint: string;

  toolbarAriaLabel: string;
  toolbarSpaceSectionHeading: string;
  toolbarAddSignageSectionHeading: string;
  toolbarSelectedSignageSectionHeading: string;
  toolbarAppearanceSectionHeading: string;
  toolbarExportSectionHeading: string;
  toolbarContentEmptyHint: string;
  toolbarAppearanceEmptyHint: string;
  toolbarAppearanceUnsupportedHint: string;
  toolbarSelectedSignageTypeLabel: string;
  signageTypeText: string;
  signageTypeImage: string;
  signageTypeWallLed: string;
  signageTypeStandDisplay: string;
  signageTypePortable: string;
  exportResolutionLabel: string;

  headerCompareToOriginalButton: string;
  headerCompareToResultButton: string;

  comparisonToggleGroupLabel: string;
  comparisonResultLabel: string;
  comparisonOriginalLabel: string;
  comparisonOriginalNoSpaceHint: string;

  statusBarHintNoSpace: string;
  statusBarHintNoSignage: string;
  statusBarHintNoContent: string;
  statusBarHintReady: string;

  onboardingTitle: string;
  onboardingDescription: string;
  onboardingStartButton: string;
  onboardingDismissButton: string;
}
