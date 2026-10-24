// The catalogue's categories and their components, in page order. Generated with _catalog.tsx; the rail reads it.
export interface CatalogueEntry {
	id: string;
	title: string;
}
export interface CatalogueCategory {
	id: string;
	title: string;
	components: CatalogueEntry[];
}
export const CATEGORIES: CatalogueCategory[] = [
	{ id: "actions", title: "Actions", components: [
		{ id: "button", title: "Button" },
		{ id: "button-group", title: "Button group" },
		{ id: "toggle", title: "Toggle" },
		{ id: "toggle-group", title: "Toggle group" },
	] },
	{ id: "forms", title: "Forms", components: [
		{ id: "calendar", title: "Calendar" },
		{ id: "checkbox", title: "Checkbox" },
		{ id: "combobox", title: "Combobox" },
		{ id: "field", title: "Field" },
		{ id: "input", title: "Input" },
		{ id: "input-group", title: "Input group" },
		{ id: "input-otp", title: "Input OTP" },
		{ id: "label", title: "Label" },
		{ id: "native-select", title: "Native select" },
		{ id: "radio-group", title: "Radio group" },
		{ id: "select", title: "Select" },
		{ id: "slider", title: "Slider" },
		{ id: "switch", title: "Switch" },
		{ id: "textarea", title: "Textarea" },
	] },
	{ id: "navigation", title: "Navigation", components: [
		{ id: "breadcrumb", title: "Breadcrumb" },
		{ id: "command", title: "Command" },
		{ id: "menubar", title: "Menubar" },
		{ id: "navigation-menu", title: "Navigation menu" },
		{ id: "pagination", title: "Pagination" },
		{ id: "sidebar", title: "Sidebar" },
		{ id: "tabs", title: "Tabs" },
	] },
	{ id: "overlays", title: "Overlays", components: [
		{ id: "alert-dialog", title: "Alert dialog" },
		{ id: "context-menu", title: "Context menu" },
		{ id: "dialog", title: "Dialog" },
		{ id: "drawer", title: "Drawer" },
		{ id: "dropdown-menu", title: "Dropdown menu" },
		{ id: "hover-card", title: "Hover card" },
		{ id: "popover", title: "Popover" },
		{ id: "sheet", title: "Sheet" },
		{ id: "tooltip", title: "Tooltip" },
	] },
	{ id: "layout", title: "Layout and disclosure", components: [
		{ id: "accordion", title: "Accordion" },
		{ id: "aspect-ratio", title: "Aspect ratio" },
		{ id: "carousel", title: "Carousel" },
		{ id: "card", title: "Card" },
		{ id: "collapsible", title: "Collapsible" },
		{ id: "direction", title: "Direction" },
		{ id: "resizable", title: "Resizable" },
		{ id: "scroll-area", title: "Scroll area" },
		{ id: "separator", title: "Separator" },
	] },
	{ id: "feedback", title: "Feedback", components: [
		{ id: "alert", title: "Alert" },
		{ id: "empty", title: "Empty" },
		{ id: "marker", title: "Marker" },
		{ id: "progress", title: "Progress" },
		{ id: "skeleton", title: "Skeleton" },
		{ id: "sonner", title: "Sonner (toast)" },
		{ id: "spinner", title: "Spinner" },
	] },
	{ id: "data", title: "Data display", components: [
		{ id: "avatar", title: "Avatar" },
		{ id: "badge", title: "Badge" },
		{ id: "chart", title: "Chart" },
		{ id: "item", title: "Item" },
		{ id: "kbd", title: "Keyboard key" },
		{ id: "table", title: "Table" },
	] },
	{ id: "chat", title: "Chat and content", components: [
		{ id: "attachment", title: "Attachment" },
		{ id: "bubble", title: "Bubble" },
		{ id: "code-block", title: "Code block" },
		{ id: "message", title: "Message" },
		{ id: "message-scroller", title: "Message scroller" },
		{ id: "questionnaire", title: "Questionnaire" },
		{ id: "trace", title: "Trace" },
	] },
];
