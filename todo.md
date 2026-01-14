# Wine Label Cropper - TODO

## Core Features
- [x] Image upload interface with drag & drop support
- [x] Image preview and validation
- [x] LLM Vision detection with normalized [0-1000] prompt
- [x] Canvas cropping algorithm with scaleX/scaleY correction
- [x] Safety padding implementation for detected regions
- [x] Bounding box visualization overlay on original image
- [x] Gallery display of detected label crops
- [x] Individual download option for each crop
- [x] S3 storage for original images
- [x] S3 storage for processed crops

## UI/UX
- [x] Elegant and refined visual design
- [x] Responsive layout for desktop and mobile
- [x] Loading states and progress indicators
- [x] Error handling and user feedback
- [x] Accessibility compliance

## Backend
- [x] tRPC procedure for image upload
- [x] tRPC procedure for LLM Vision detection
- [x] Canvas cropping logic implementation
- [x] S3 integration for file storage
- [x] Error handling and validation

## Testing & Deployment
- [x] Test with single bottle image
- [x] Test with multiple bottles image
- [x] Verify S3 uploads and downloads
- [x] Browser testing and optimization
