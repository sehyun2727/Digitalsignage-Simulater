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

  editorAddTextButton: string;
  editorAddImageButton: string;
  editorDeleteButton: string;
  editorUndoButton: string;
  editorRedoButton: string;
  editorExportButton: string;
  editorExportVideoButton: string;
  editorExportVideoInProgressButton: string;
  editorExportVideoUnsupportedHint: string;
  editorExportedVideoAnnouncement: string;
  editorExportVideoErrorAnnouncement: string;
  editorContentVideoAutoplayHint: string;
  editorCanvasEmptyHint: string;
  editorCanvasNoSignageHint: string;
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
  editorVideoUploadErrorUnsupportedType: string;
  editorVideoUploadErrorTooLarge: string;
  editorVideoUploadErrorUnsupportedCodec: string;
  editorVideoUploadErrorDecodeFailed: string;
  editorExportedAnnouncement: string;
  editorExportErrorAnnouncement: string;

  editorSpaceBackgroundLabel: string;
  editorAddSpaceBackgroundButton: string;
  editorReplaceSpaceBackgroundButton: string;
  editorRemoveSpaceBackgroundButton: string;
  toolbarSpaceEmptyHint: string;
  editorSpaceBackgroundDimensionsLabel: string;
  editorSpaceBackgroundDownscaledNotice: string;
  editorSpaceBackgroundPrivacyNotice: string;

  editorAddLedButton: string;
  editorAddLcdButton: string;
  editorAddTransparentLedButton: string;
  toolbarAddSignageDisabledHint: string;

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

  editorRenderingPresetLabel: string;
  editorRenderingPresetNatural: string;
  editorRenderingPresetBright: string;
  editorRenderingPresetNight: string;
  editorRenderingPresetHint: string;

  editorMaterialLabel: string;
  editorMaterialLed: string;
  editorMaterialLcd: string;
  editorMaterialTransparentLed: string;
  editorMaterialIntensityLabel: string;
  editorMaterialBrightnessLabel: string;
  editorMaterialTransparencyLabel: string;
  editorMaterialGridDensityLabel: string;
  editorMaterialGlowLabel: string;
  editorMaterialContrastLabel: string;
  editorMaterialAdvancedToggleLabel: string;
  editorMaterialResetButton: string;
  editorMaterialPreviewNotice: string;
  editorTransparentLedDisclaimer: string;

  editorCurvatureModeLabel: string;
  editorCurvatureFlat: string;
  editorCurvatureConcave: string;
  editorCurvatureConvex: string;
  editorCurvatureAmountLabel: string;
  editorCurvatureResetButton: string;
  editorCurvatureUnsupportedHint: string;

  editorContactShadowLabel: string;
  editorContactShadowEnableLabel: string;
  editorContactShadowStrengthLabel: string;
  editorContactShadowBlurLabel: string;
  editorContactShadowOffsetXLabel: string;
  editorContactShadowOffsetYLabel: string;
  editorContactShadowSpreadLabel: string;
  editorContactShadowDepthLabel: string;
  editorContactShadowTintLabel: string;
  editorContactShadowResetButton: string;
  editorEnvironmentIntegrationLabel: string;
  editorEnvironmentIntegrationStrengthLabel: string;
  editorEnvironmentIntegrationResetButton: string;

  editorPerspectiveFitButton: string;
  editorPerspectiveUseRectButton: string;
  editorPerspectiveHint: string;
  editorPerspectiveCornerTopLeft: string;
  editorPerspectiveCornerTopRight: string;
  editorPerspectiveCornerBottomRight: string;
  editorPerspectiveCornerBottomLeft: string;
  editorPerspectiveApplyButton: string;
  editorPerspectiveCancelButton: string;
  editorPerspectiveResetButton: string;
  editorPerspectiveErrorOutOfBounds: string;
  editorPerspectiveErrorSelfIntersecting: string;
  editorPerspectiveErrorConcave: string;
  editorPerspectiveErrorMinArea: string;
  editorPerspectiveErrorMinEdge: string;
  editorPerspectiveErrorInvalidValues: string;

  editorInstallationModeLabel: string;
  editorInstallationModeWall: string;
  editorInstallationModeWindow: string;
  editorInstallationModeFreestanding: string;

  editorOcclusionLabel: string;
  editorOcclusionMaskItemLabel: string;
  editorOcclusionEmptyHint: string;
  editorOcclusionAddButton: string;
  editorOcclusionEditButton: string;
  editorOcclusionDeleteButton: string;
  editorOcclusionEnableLabel: string;
  editorOcclusionPointLabel: string;
  editorOcclusionHint: string;
  editorOcclusionFeatherLabel: string;
  editorOcclusionOpacityLabel: string;
  editorOcclusionApplyButton: string;
  editorOcclusionCancelButton: string;
  editorOcclusionNoSpaceHint: string;
  editorOcclusionErrorTooFewPoints: string;
  editorOcclusionErrorTooManyPoints: string;
  editorOcclusionErrorInvalidValues: string;
  editorOcclusionErrorOutOfBounds: string;
  editorOcclusionErrorDuplicatePoints: string;
  editorOcclusionErrorSelfIntersecting: string;
  editorOcclusionErrorMinArea: string;

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
  toolbarExportDisabledReason: string;
  signageTypeText: string;
  signageTypeImage: string;
  signageTypeLed: string;
  signageTypeLcd: string;
  signageTypeTransparentLed: string;
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
