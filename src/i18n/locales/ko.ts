import type { Messages } from '../../types/i18n';

export const ko: Messages = {
  appTitle: 'Digital Signage Simulator',
  disclaimer:
    '본 서비스는 개인이 기획·운영하는 독립적인 디지털 사이니지 시뮬레이션 도구이며, HULL 주식회사의 공식 서비스가 아닙니다.',
  languageSelectorLabel: '언어',
  localeName: {
    ja: '日本語',
    ko: '한국어',
    en: 'English',
  },
  hullCtaLabel: 'HULL에 문의하기',
  hullCtaExternalNotice: '외부 HULL 공식 웹사이트가 새 탭에서 열립니다.',

  editorTemplateLabel: '템플릿',
  editorTemplateWallLed: '벽걸이형 LED',
  editorTemplateStandDisplay: '스탠드형 디스플레이',
  editorAddTextButton: '텍스트 추가',
  editorAddImageButton: '이미지 추가',
  editorDeleteButton: '삭제',
  editorUndoButton: '실행 취소',
  editorRedoButton: '다시 실행',
  editorExportButton: 'PNG로 내보내기',
  editorBackgroundColorLabel: '배경색',
  editorEmptyCanvasHint: '아직 요소가 없습니다. 텍스트 또는 이미지를 추가해 보세요.',
  editorPropertiesTitle: '속성',
  editorPropertiesEmptyHint: '요소를 선택하면 속성을 편집할 수 있습니다.',
  editorPositionXLabel: 'X 좌표',
  editorPositionYLabel: 'Y 좌표',
  editorWidthLabel: '너비',
  editorHeightLabel: '높이',
  editorRotationLabel: '회전',
  editorTextContentLabel: '텍스트 내용',
  editorFontSizeLabel: '글자 크기',
  editorTextColorLabel: '글자 색상',
  editorTextAlignLabel: '텍스트 정렬',
  editorAlignLeft: '왼쪽 정렬',
  editorAlignCenter: '가운데 정렬',
  editorAlignRight: '오른쪽 정렬',
  editorImageUploadErrorUnsupportedType: 'PNG, JPEG, WebP 형식의 이미지만 사용할 수 있습니다.',
  editorImageUploadErrorTooLarge: '이미지 크기는 10MB 이하여야 합니다.',
  editorImageUploadErrorDecodeFailed:
    '이미지를 불러오지 못했습니다. 파일이 손상되었을 수 있습니다.',
  editorExportedAnnouncement: 'PNG 이미지를 내보냈습니다.',
  editorExportErrorAnnouncement: 'PNG 이미지 내보내기에 실패했습니다. 다시 시도해 주세요.',

  editorSpaceBackgroundLabel: '공간 사진',
  editorAddSpaceBackgroundButton: '공간 사진 추가',
  editorRemoveSpaceBackgroundButton: '공간 사진 삭제',
  editorAddWallLedButton: '벽걸이형 LED 추가',
  editorAddStandDisplayButton: '스탠드형 디스플레이 추가',

  editorContentLabel: '화면 콘텐츠',
  editorContentUploadButton: '콘텐츠 추가',
  editorContentReplaceButton: '콘텐츠 교체',
  editorContentRemoveButton: '콘텐츠 제거',
  editorContentNoneHint: '아직 콘텐츠가 없습니다. 이미지를 추가해 주세요.',
  editorContentFitLabel: '표시 방식',
  editorContentFitContain: '전체 표시 (Contain)',
  editorContentFitCover: '화면 꽉 채우기 (Cover)',
  editorContentOffsetXLabel: '콘텐츠 위치 X',
  editorContentOffsetYLabel: '콘텐츠 위치 Y',
  editorContentScaleLabel: '콘텐츠 확대 비율',
  editorContentResetButton: '콘텐츠 배치 초기화',

  editorMaterialLabel: '디스플레이 소재',
  editorMaterialOutdoorLed: '실외 LED',
  editorMaterialLcd: 'LCD',
  editorMaterialIntensityLabel: '질감 강도',
  editorMaterialBrightnessLabel: '밝기',
  editorMaterialResetButton: '효과 초기화',
  editorMaterialPreviewNotice:
    '화면 질감과 밝기는 시각적 참고용 표현이며 실제 제품 성능을 보장하지 않습니다.',

  editorTemplateSectionHeading: '기본 템플릿',
  portableSectionHeading: '내 포터블 제품',
  editorAddPortableButton: '포터블 제품 추가',
  portableTypeLabel: '종류',
  portableTypeValue: '포터블 제품',

  portableBackgroundNotice:
    '배경이 투명한 PNG 또는 WebP를 사용하면 더 자연스럽게 배치할 수 있습니다. JPG나 배경이 포함된 이미지에서는 제품 사진의 배경도 함께 표시됩니다.',
  portableRightsNotice:
    '업로드하는 제품 이미지에 필요한 권리 또는 사용 허가가 있는지 확인해 주세요. 이미지는 브라우저에서 처리되며 서버에 저장되지 않습니다.',
  portableSupportedFormatsHint: 'JPG, JPEG, PNG, WebP 형식의 이미지를 사용할 수 있습니다.',

  portableStepSelectPhotoTitle: '제품 사진 선택',
  portableStepDefineRegionTitle: '화면 영역 지정',
  portableSelectPhotoButton: '제품 사진 선택',
  portableChangePhotoButton: '제품 사진 변경',
  portableNoPhotoSelectedHint: '아직 선택된 사진이 없습니다.',

  portableScreenRegionDragHint: '사진 위를 드래그하여 화면이 될 영역을 지정해 주세요.',
  portableScreenRegionMoveResizeHint:
    '이미 지정된 영역 안쪽을 드래그하면 이동, 네 모서리의 핸들을 드래그하면 크기 조절이 가능합니다. 키보드에서는 아래 X·Y·너비·높이 숫자 입력란으로 동일하게 조작할 수 있습니다.',
  portableScreenRegionXLabel: '영역 X',
  portableScreenRegionYLabel: '영역 Y',
  portableScreenRegionWidthLabel: '영역 너비',
  portableScreenRegionHeightLabel: '영역 높이',
  portableScreenRegionResetButton: '영역 초기화',
  portableScreenRegionEditButton: '화면 영역 편집',
  portableScreenRegionMinSizeError:
    '화면 영역이 너무 작습니다. 사진 가로·세로 각각 5% 이상으로 지정해 주세요.',

  portableCancelButton: '취소',
  portableBackButton: '이전',
  portableNextButton: '다음',
  portableAddButton: '추가',
  portableSaveButton: '저장',
  portableReplacePhotoHint:
    '사진을 교체하려면 이 제품을 삭제한 후 새 포터블 제품으로 다시 추가해 주세요.',
};
