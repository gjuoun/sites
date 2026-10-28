import * as React from "react";
import { Spinner } from "@gjuoun/bigface-business-ui/components/ui/spinner";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@gjuoun/bigface-business-ui/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@gjuoun/bigface-business-ui/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@gjuoun/bigface-business-ui/components/ui/alert";
import { Attachment, AttachmentContent, AttachmentMedia, AttachmentTitle } from "@gjuoun/bigface-business-ui/components/ui/attachment";
import { Avatar, AvatarFallback } from "@gjuoun/bigface-business-ui/components/ui/avatar";
import { Badge } from "@gjuoun/bigface-business-ui/components/ui/badge";
import { Bubble, BubbleContent, BubbleReactions } from "@gjuoun/bigface-business-ui/components/ui/bubble";
import { Folder, Home } from "lucide-react";
import { Button } from "@gjuoun/bigface-business-ui/components/ui/button";
import { ButtonGroup } from "@gjuoun/bigface-business-ui/components/ui/button-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@gjuoun/bigface-business-ui/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@gjuoun/bigface-business-ui/components/ui/carousel";
import { Checkbox } from "@gjuoun/bigface-business-ui/components/ui/checkbox";
import { CodeBlock, CodeBlockContent, CodeBlockLine } from "@gjuoun/bigface-business-ui/components/ui/code-block";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@gjuoun/bigface-business-ui/components/ui/context-menu";
import { DirectionProvider } from "@gjuoun/bigface-business-ui/components/ui/direction";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@gjuoun/bigface-business-ui/components/ui/drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@gjuoun/bigface-business-ui/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@gjuoun/bigface-business-ui/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@gjuoun/bigface-business-ui/components/ui/field";
import { Input } from "@gjuoun/bigface-business-ui/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@gjuoun/bigface-business-ui/components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@gjuoun/bigface-business-ui/components/ui/item";
import { Marker, MarkerContent, MarkerIcon } from "@gjuoun/bigface-business-ui/components/ui/marker";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from "@gjuoun/bigface-business-ui/components/ui/menubar";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader } from "@gjuoun/bigface-business-ui/components/ui/message";
import { NativeSelect, NativeSelectOption } from "@gjuoun/bigface-business-ui/components/ui/native-select";
import { Progress } from "@gjuoun/bigface-business-ui/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@gjuoun/bigface-business-ui/components/ui/radio-group";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@gjuoun/bigface-business-ui/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@gjuoun/bigface-business-ui/components/ui/select";
import { Separator } from "@gjuoun/bigface-business-ui/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@gjuoun/bigface-business-ui/components/ui/sheet";
import { Sidebar, SidebarContent, SidebarGroup, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarTrigger } from "@gjuoun/bigface-business-ui/components/ui/sidebar";
import { Slider } from "@gjuoun/bigface-business-ui/components/ui/slider";
import { Switch } from "@gjuoun/bigface-business-ui/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@gjuoun/bigface-business-ui/components/ui/tabs";
import { Textarea } from "@gjuoun/bigface-business-ui/components/ui/textarea";
import { Toggle } from "@gjuoun/bigface-business-ui/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@gjuoun/bigface-business-ui/components/ui/toggle-group";
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@gjuoun/bigface-business-ui/components/ui/trace";

// Variants and states, per component. A VARIANT is an option the component's own source declares (a cva variant or
// a typed prop union); a STATE is a real prop (disabled, checked, invalid, value). Each cell is a live instance:
// the stock component with the option set, so hover, focus and press work on it. Components the source declares no
// axis for have no entry, and the card says so.

const SIDES = ["top", "right", "bottom", "left"] as const;
const BUTTON_VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "link", "glow"] as const;
const BUTTON_SIZES = ["default", "xs", "sm", "lg"] as const;
const ICON_SIZES = ["icon", "icon-xs", "icon-sm", "icon-lg"] as const;

/** One labelled row: the label on the left, its live cells on the right. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,4fr)] md:items-center md:gap-4">
			<span className="font-mono text-xs text-muted-foreground">{label}</span>
			<div className="flex min-h-9 min-w-0 flex-wrap items-center gap-3">{children}</div>
		</div>
	);
}

/** A two-axis enumeration: rows by one option, columns by the other. Scrolls inside itself on a narrow screen. */
function Matrix<R extends string, C extends string>({ corner, rows, cols, cell, track = "row" }: { corner: string; rows: readonly R[]; cols: readonly C[]; cell: (r: R, c: C) => React.ReactNode; track?: "row" | "column" }) {
	return (
		<div className="overflow-x-auto">
			{/* Each column keeps 220px at least, so a specimen is never narrower than its label: the table scrolls inside itself instead. */}
			<table className="w-full table-fixed text-sm" style={{ minWidth: Math.max(480, 220 * cols.length) }}>
				<colgroup>
					<col style={{ width: "20%" }} />
					{cols.map((c) => (
						<col key={c} style={{ width: 80 / cols.length + "%" }} />
					))}
				</colgroup>
				<thead>
					<tr>
						<th className="px-2 py-2 text-left font-mono text-xs font-normal text-muted-foreground">{corner}</th>
						{cols.map((c) => (
							<th key={c} className="px-2 py-2 text-left font-mono text-xs font-normal text-muted-foreground">{c}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r} className="border-t">
							<th scope="row" className="px-2 py-3 text-left font-mono text-xs font-normal text-muted-foreground">{r}</th>
							{cols.map((c) => (
								<td key={c} className="px-2 py-3 align-middle"><span className={"flex w-full min-w-0 min-h-9 items-center justify-center rounded-sm outline-1 -outline-offset-1 outline-dashed outline-border px-1.5 py-1" + (track === "column" ? " flex-col items-stretch" : "")}>{cell(r, c)}</span></td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** One sidebar frame: the stock sidebar and its page in a box tall enough to read the sidebar's own chrome. Each frame
    is its own provider, so the value it names is the only thing that differs between frames. */
function SidebarFrame({ label, variant = "sidebar", collapsible, side = "left", open, trigger = false }: { label: string; variant?: "sidebar" | "floating" | "inset"; collapsible: "offcanvas" | "icon" | "none"; side?: "left" | "right"; open: boolean; trigger?: boolean }) {
	return (
		<figure data-frame={label} className="m-0 flex min-w-0 flex-col gap-1.5">
			<figcaption className="font-mono text-xs text-muted-foreground">{label}</figcaption>
			<div className="relative h-56 w-full overflow-hidden rounded-md border [transform:translateZ(0)]">
				<SidebarProvider defaultOpen={open} className="h-full min-h-0">
					{side === "right" ? (<>
					<SidebarInset className="p-3 text-sm">{trigger ? <SidebarTrigger data-frame-trigger aria-label="Toggle this sidebar" /> : null}Content</SidebarInset>
					<Sidebar variant={variant} collapsible={collapsible} side={side}>
						<SidebarContent>
							<SidebarGroup>
								<SidebarMenu>
									<SidebarMenuItem><SidebarMenuButton isActive><Home />Home</SidebarMenuButton></SidebarMenuItem>
									<SidebarMenuItem><SidebarMenuButton><Folder />Projects</SidebarMenuButton></SidebarMenuItem>
								</SidebarMenu>
								<SidebarMenuSub>
									<SidebarMenuSubItem><SidebarMenuSubButton size="sm">Sub small</SidebarMenuSubButton></SidebarMenuSubItem>
									<SidebarMenuSubItem><SidebarMenuSubButton size="md">Sub medium</SidebarMenuSubButton></SidebarMenuSubItem>
								</SidebarMenuSub>
							</SidebarGroup>
						</SidebarContent>
					</Sidebar>
					</>) : (<>
					<Sidebar variant={variant} collapsible={collapsible} side={side}>
						<SidebarContent>
							<SidebarGroup>
								<SidebarMenu>
									<SidebarMenuItem><SidebarMenuButton isActive><Home />Home</SidebarMenuButton></SidebarMenuItem>
									<SidebarMenuItem><SidebarMenuButton><Folder />Projects</SidebarMenuButton></SidebarMenuItem>
								</SidebarMenu>
								<SidebarMenuSub>
									<SidebarMenuSubItem><SidebarMenuSubButton size="sm">Sub small</SidebarMenuSubButton></SidebarMenuSubItem>
									<SidebarMenuSubItem><SidebarMenuSubButton size="md">Sub medium</SidebarMenuSubButton></SidebarMenuSubItem>
								</SidebarMenuSub>
							</SidebarGroup>
						</SidebarContent>
					</Sidebar>
					<SidebarInset className="p-3 text-sm">{trigger ? <SidebarTrigger data-frame-trigger aria-label="Toggle this sidebar" /> : null}Content</SidebarInset>
					</>)}
				</SidebarProvider>
			</div>
		</figure>
	);
}

/** A sub-heading inside a card, styled like the group labels so the matrices read as named blocks. */
function SubHead({ children }: { children: React.ReactNode }) {
	return <h5 className="border-b pb-1 text-xs font-semibold tracking-[0.08em] text-foreground uppercase">{children}</h5>;
}

/** A state: a label above one live instance. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col items-start gap-1.5">
			<span className="font-mono text-xs text-muted-foreground">{label}</span>
			{children}
		</div>
	);
}

/** The states of a component, one labelled row each, in the same row grid as the variants. */
const states = (...cells: React.ReactNode[]) => (
	<div className="flex flex-col divide-y">
		{cells.map((c, i) => {
			const el = c as React.ReactElement<{ label: string; children: React.ReactNode }>;
			return (
				<div key={i} className="grid items-center gap-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,4fr)] md:gap-4">
					<span className="font-mono text-xs text-muted-foreground">{el.props.label}</span>
					<div className="flex min-h-9 min-w-0 flex-wrap items-center gap-3">{el.props.children}</div>
				</div>
			);
		})}
	</div>
);

export const VARIANTS: Record<string, React.ReactNode> = {
	switch: (
		<div className="flex flex-col divide-y">
			{(["default", "sm"] as const).map((s) => (
				<Row key={s} label={"size=" + s}><Switch size={s} /><Switch size={s} defaultChecked /></Row>
			))}
		</div>
	),
	alert: (
		<div className="flex flex-col divide-y">
			<Row label="variant=default"><Alert className="w-full max-w-md"><AlertTitle>Heads up</AlertTitle><AlertDescription>A default alert.</AlertDescription></Alert></Row>
			<Row label="variant=destructive"><Alert variant="destructive" className="w-full max-w-md"><AlertTitle>Failed</AlertTitle><AlertDescription>A destructive alert.</AlertDescription></Alert></Row>
		</div>
	),
	"alert-dialog": (
		<div className="flex flex-col divide-y">
			{(["default", "sm"] as const).map((s) => (
				<Row key={s} label={"size=" + s}>
					<AlertDialog>
						<AlertDialogTrigger asChild><Button variant="outline">Open {s}</Button></AlertDialogTrigger>
						<AlertDialogContent size={s}>
							<AlertDialogHeader>
								<AlertDialogTitle>Are you sure?</AlertDialogTitle>
								<AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction>Continue</AlertDialogAction></AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</Row>
			))}
		</div>
	),
	attachment: (
		<div className="flex flex-col gap-4">
			<Matrix corner="orientation / size" rows={["horizontal", "vertical"] as const} cols={["default", "sm", "xs"] as const} cell={(r, c) => (
				<Attachment size={c} orientation={r} className="max-w-full">
					<AttachmentMedia variant="icon" className={r === "vertical" ? "aspect-auto h-12" : undefined}>PDF</AttachmentMedia>
					<AttachmentContent><AttachmentTitle>report.pdf</AttachmentTitle></AttachmentContent>
				</Attachment>
			)} />
			<Matrix corner="media / size" rows={["icon", "image"] as const} cols={["default", "sm", "xs"] as const} cell={(r, c) => (
				<Attachment size={c} className="max-w-full">
					<AttachmentMedia variant={r}>{r === "image" ? "IMG" : "ZIP"}</AttachmentMedia>
					<AttachmentContent><AttachmentTitle>{r + ".file"}</AttachmentTitle></AttachmentContent>
				</Attachment>
			)} />
		</div>
	),
	avatar: (
		<div className="flex flex-col divide-y">
			{(["sm", "default", "lg"] as const).map((s) => (
				<Row key={s} label={"size=" + s}><Avatar size={s}><AvatarFallback>JG</AvatarFallback></Avatar></Row>
			))}
		</div>
	),
	badge: (
		<Row label="variant">
			{(["default", "secondary", "destructive", "outline", "ghost", "link"] as const).map((v) => (
				<Badge key={v} variant={v}>{v}</Badge>
			))}
		</Row>
	),
	bubble: (
		<div className="flex flex-col gap-4">
		<SubHead>Variant × align</SubHead>
		<Matrix corner="variant / align" track="column" rows={["default", "secondary", "muted", "tinted", "outline", "ghost", "destructive"] as const} cols={["start", "end"] as const} cell={(r, c) => (
			<Bubble align={c} variant={r}><BubbleContent>{r}</BubbleContent></Bubble>
		)} />
		<SubHead>Reactions (side × align)</SubHead>
		<Matrix corner="side / align" track="column" rows={["top", "bottom"] as const} cols={["start", "end"] as const} cell={(r, c) => (
			<div className="flex w-full flex-col py-6">
				<Bubble align={c}><BubbleContent>{c}</BubbleContent><BubbleReactions side={r} align={c}>+1</BubbleReactions></Bubble>
			</div>
		)} />
		</div>
	),
	button: (
		<div className="flex flex-col gap-4">
			<SubHead>Text sizes</SubHead>
			<Matrix corner="variant / size" rows={BUTTON_VARIANTS} cols={BUTTON_SIZES} cell={(r, c) => <Button variant={r} size={c}>{r}</Button>} />
			<SubHead>Icon sizes</SubHead>
			<Matrix corner="variant / icon size" rows={BUTTON_VARIANTS} cols={ICON_SIZES} cell={(r, c) => <Button variant={r} size={c} aria-label={c}>+</Button>} />
		</div>
	),
	"button-group": (
		<div className="flex flex-col divide-y">
			{(["horizontal", "vertical"] as const).map((o) => (
				<Row key={o} label={"orientation=" + o}>
					<ButtonGroup orientation={o}><Button variant="outline">One</Button><Button variant="outline">Two</Button></ButtonGroup>
				</Row>
			))}
		</div>
	),
	card: (
		<div className="flex flex-col divide-y">
			{(["default", "sm"] as const).map((s) => (
				<Row key={s} label={"size=" + s}>
					<Card size={s} className="w-full max-w-sm">
						<CardHeader><CardTitle>Workspace</CardTitle><CardDescription>Card at size {s}.</CardDescription></CardHeader>
						<CardContent>Content goes here.</CardContent>
					</Card>
				</Row>
			))}
		</div>
	),
	carousel: (
		<div className="flex flex-col divide-y">
			{(["horizontal", "vertical"] as const).map((o) => (
				<Row key={o} label={"orientation=" + o}>
					<Carousel orientation={o} className={o === "horizontal" ? "mx-12 w-[calc(100%-6rem)] max-w-xs" : "my-12 max-w-xs"}>
						<CarouselContent className={o === "vertical" ? "h-40" : undefined}>
							{["One", "Two", "Three"].map((label) => (
								<CarouselItem key={label}><div className="flex h-24 items-center justify-center rounded-md border text-lg font-semibold">{label}</div></CarouselItem>
							))}
						</CarouselContent>
						<CarouselPrevious />
						<CarouselNext />
					</Carousel>
				</Row>
			))}
		</div>
	),
	"code-block": (
		<div className="flex flex-col divide-y">
			{(["default", "destructive"] as const).map((v) => (
				<Row key={v} label={"variant=" + v}>
					<CodeBlock variant={v} className="w-full max-w-md"><CodeBlockContent><CodeBlockLine>bun add @gjuoun/bigface-business-ui</CodeBlockLine></CodeBlockContent></CodeBlock>
				</Row>
			))}
			{(["default", "sm"] as const).map((s) => (
				<Row key={s} label={"size=" + s}>
					<CodeBlock size={s} className="w-full max-w-md"><CodeBlockContent><CodeBlockLine>bun add @gjuoun/bigface-business-ui</CodeBlockLine></CodeBlockContent></CodeBlock>
				</Row>
			))}
			{(["default", "added", "removed", "highlighted"] as const).map((v) => (
				<Row key={v} label={"line=" + v}>
					<CodeBlock className="w-full max-w-md"><CodeBlockContent><CodeBlockLine variant={v}>const width = 240;</CodeBlockLine></CodeBlockContent></CodeBlock>
				</Row>
			))}
		</div>
	),
	"context-menu": (
		<div className="flex flex-col gap-3">
			<div className="grid gap-3 sm:grid-cols-2">
				{SIDES.map((s) => (
					<ContextMenu key={s}>
						<ContextMenuTrigger className="flex h-20 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">Right-click, side {s}</ContextMenuTrigger>
						<ContextMenuContent side={s}>
							<ContextMenuItem>Default item</ContextMenuItem>
							<ContextMenuItem variant="destructive">Destructive item</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
				))}
			</div>
			<div className="flex flex-col divide-y">
				{(["default", "destructive"] as const).map((v) => (
					<Row key={v} label={"variant=" + v + " · right-click"}>
						<ContextMenu>
							<ContextMenuTrigger className="flex h-20 w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">Right-click for {v}</ContextMenuTrigger>
							<ContextMenuContent><ContextMenuItem variant={v}>{v === "default" ? "Default item" : "Destructive item"}</ContextMenuItem></ContextMenuContent>
						</ContextMenu>
					</Row>
				))}
			</div>
		</div>
	),
	direction: (
		<div className="flex flex-col divide-y">
			{(["ltr", "rtl"] as const).map((d) => (
				<Row key={d} label={"dir=" + d}>
					<DirectionProvider dir={d}>
						<div dir={d} className="flex w-64 flex-col gap-2 rounded-md border p-3 text-sm">
							<Button variant="outline" size="sm">Next</Button>
							<p>Reading direction: {d}</p>
						</div>
					</DirectionProvider>
				</Row>
			))}
		</div>
	),
	drawer: (
		<div className="flex flex-wrap gap-3">
			{(["top", "right", "bottom", "left"] as const).map((d) => (
				<Drawer key={d} direction={d}>
					<DrawerTrigger asChild><Button variant="outline">{d}</Button></DrawerTrigger>
					<DrawerContent>
						<DrawerHeader><DrawerTitle>Drawer from {d}</DrawerTitle><DrawerDescription>Opens from the {d} edge.</DrawerDescription></DrawerHeader>
						<DrawerFooter><Button>Done</Button></DrawerFooter>
					</DrawerContent>
				</Drawer>
			))}
		</div>
	),
	"dropdown-menu": (
		<div className="flex flex-col divide-y">
			{(["default", "destructive"] as const).map((v) => (
				<Row key={v} label={"variant=" + v + " · opens on click"}>
					<DropdownMenu>
						<DropdownMenuTrigger asChild><Button variant="outline">Open {v} menu</Button></DropdownMenuTrigger>
						<DropdownMenuContent><DropdownMenuItem variant={v}>{v === "default" ? "Default item" : "Destructive item"}</DropdownMenuItem></DropdownMenuContent>
					</DropdownMenu>
				</Row>
			))}
		</div>
	),
	empty: (
		<div className="flex flex-col divide-y">
			{(["default", "icon"] as const).map((v) => (
				<Row key={v} label={"media=" + v}>
					<Empty className="w-full max-w-md border">
						<EmptyHeader>
							<EmptyMedia variant={v}>∅</EmptyMedia>
							<EmptyTitle>No projects</EmptyTitle>
							<EmptyDescription>Create one to start.</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</Row>
			))}
		</div>
	),
	field: (
		<div className="flex flex-col divide-y">
			{(["legend", "label"] as const).map((v) => (
				<Row key={v} label={"variant=" + v}>
					<FieldSet className="w-full max-w-md"><FieldLegend variant={v}>Account</FieldLegend><FieldDescription>Rendered as a {v}.</FieldDescription></FieldSet>
				</Row>
			))}
			{(["vertical", "horizontal", "responsive"] as const).map((o) => (
				<Row key={o} label={"orientation=" + o}>
					<FieldGroup className="w-full max-w-md">
						<Field orientation={o}>
							<FieldLabel htmlFor={"field-" + o}>Email</FieldLabel>
							<Input id={"field-" + o} placeholder="you@example.com" />
							<FieldDescription>We never share it.</FieldDescription>
						</Field>
					</FieldGroup>
				</Row>
			))}
		</div>
	),
	"input-group": (
		<div className="flex flex-col divide-y">
			{(["inline-start", "inline-end", "block-start", "block-end"] as const).map((a) => (
				<Row key={a} label={"align=" + a}>
					<InputGroup className="w-full">
						<InputGroupAddon align={a}><InputGroupText>{a}</InputGroupText></InputGroupAddon>
						<InputGroupInput placeholder="Type here" />
					</InputGroup>
				</Row>
			))}
			{(["xs", "sm", "icon-xs", "icon-sm"] as const).map((s) => (
				<Row key={s} label={"button size=" + s}>
					{/* A narrow card can be narrower than this group; it scrolls inside its own box rather than spilling its addon. */}
					<div className="min-w-0 w-full overflow-x-auto p-1">
					<InputGroup className="w-full max-w-sm">
						<InputGroupInput placeholder="Search" />
						<InputGroupAddon align="inline-end"><InputGroupButton size={s}>{s.startsWith("icon") ? "+" : "Go"}</InputGroupButton></InputGroupAddon>
					</InputGroup>
					</div>
				</Row>
			))}
		</div>
	),
	item: (
		<div className="flex flex-col gap-4">
			<Matrix corner="variant / size" rows={["default", "outline", "muted"] as const} cols={["default", "sm", "xs"] as const} cell={(r, c) => (
				<Item variant={r} size={c} className="w-full max-w-xs">
					<ItemContent><ItemTitle>Basic plan</ItemTitle><ItemDescription>{r} at {c}</ItemDescription></ItemContent>
				</Item>
			)} />
			<div className="flex flex-col divide-y">
				{(["default", "icon", "image"] as const).map((m) => (
					<Row key={m} label={"media=" + m}>
						<Item variant="outline" className="w-full max-w-md">
							<ItemMedia variant={m}>{m === "image" ? "IMG" : "◎"}</ItemMedia>
							<ItemContent><ItemTitle>Project</ItemTitle><ItemDescription>Media variant {m}.</ItemDescription></ItemContent>
						</Item>
					</Row>
				))}
			</div>
		</div>
	),
	marker: (
		<div className="flex flex-col divide-y">
			{(["default", "separator", "border"] as const).map((v) => (
				<Row key={v} label={"variant=" + v}>
					<Marker variant={v}><MarkerIcon>●</MarkerIcon><MarkerContent>{v}</MarkerContent></Marker>
				</Row>
			))}
		</div>
	),
	menubar: (
		<div className="flex flex-col divide-y">
			{(["default", "destructive"] as const).map((v) => (
				<Row key={v} label={"variant=" + v + " · opens on click"}>
					<Menubar>
						<MenubarMenu>
							<MenubarTrigger>{v === "default" ? "Default menu" : "Destructive menu"}</MenubarTrigger>
							<MenubarContent><MenubarItem variant={v}>{v === "default" ? "Default item" : "Destructive item"}</MenubarItem></MenubarContent>
						</MenubarMenu>
					</Menubar>
				</Row>
			))}
		</div>
	),
	message: (
		<div className="flex flex-col divide-y">
			{(["start", "end"] as const).map((a) => (
				<Row key={a} label={"align=" + a}>
					<MessageGroup className="w-full">
						<Message align={a}>
							<MessageAvatar>JG</MessageAvatar>
							<MessageContent>
								<MessageHeader>Jun</MessageHeader>
								<Bubble variant="muted" align={a}><BubbleContent>Aligned to the {a}.</BubbleContent></Bubble>
								<MessageFooter>10:02</MessageFooter>
							</MessageContent>
						</Message>
					</MessageGroup>
				</Row>
			))}
			<Row label="text · long, wraps">
				<MessageGroup className="w-full">
					<Message>
						<MessageAvatar>JG</MessageAvatar>
						<MessageContent>
							<MessageHeader>Jun</MessageHeader>
							<Bubble variant="muted" align="start"><BubbleContent>A longer message, so the reader can see how a bubble wraps across several lines at its own maximum width instead of running off the column.</BubbleContent></Bubble>
							<MessageFooter>10:03</MessageFooter>
						</MessageContent>
					</Message>
				</MessageGroup>
			</Row>
		</div>
	),
	"native-select": (
		<div className="flex flex-col divide-y">
			{(["sm", "default"] as const).map((s) => (
				<Row key={s} label={"size=" + s}>
					<NativeSelect size={s} defaultValue="a" className="w-48"><NativeSelectOption value="a">Option A</NativeSelectOption><NativeSelectOption value="b">Option B</NativeSelectOption></NativeSelect>
				</Row>
			))}
		</div>
	),
	resizable: (
		<div className="flex flex-col divide-y">
			{(["horizontal", "vertical"] as const).map((o) => (
				<Row key={o} label={"orientation=" + o}>
					<ResizablePanelGroup orientation={o} style={o === "vertical" ? { height: "12rem", width: "12rem" } : { height: "6rem" }} className={(o === "vertical" ? "" : "w-full max-w-md ") + "rounded-lg border"}>
						<ResizablePanel defaultSize={50} className="flex items-center justify-center p-2 text-sm">A</ResizablePanel>
						<ResizableHandle withHandle />
						<ResizablePanel defaultSize={50} className="flex items-center justify-center p-2 text-sm">B</ResizablePanel>
					</ResizablePanelGroup>
				</Row>
			))}
		</div>
	),
	select: (
		<div className="flex flex-col divide-y">
			{(["sm", "default"] as const).map((s) => (
				<Row key={s} label={"size=" + s}>
					<Select defaultValue="light">
						<SelectTrigger size={s} className="w-48"><SelectValue placeholder="Mode" /></SelectTrigger>
						<SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent>
					</Select>
				</Row>
			))}
		</div>
	),
	separator: (
		<div className="flex flex-col divide-y">
			<Row label="orientation=horizontal"><div className="w-64"><p className="text-sm">Above</p><Separator className="my-2" /><p className="text-sm">Below</p></div></Row>
			<Row label="orientation=vertical"><div className="flex h-10 items-center gap-3 text-sm"><span>Left</span><Separator orientation="vertical" /><span>Right</span></div></Row>
		</div>
	),
	sheet: (
		<div className="flex flex-wrap gap-3">
			{SIDES.map((s) => (
				<Sheet key={s}>
					<SheetTrigger asChild><Button variant="outline">{s}</Button></SheetTrigger>
					<SheetContent side={s}>
						<SheetHeader><SheetTitle>Sheet from {s}</SheetTitle><SheetDescription>Opens from the {s} edge.</SheetDescription></SheetHeader>
					</SheetContent>
				</Sheet>
			))}
		</div>
	),
	sidebar: (
		<div className="flex flex-col gap-4">
			<SubHead>Menu button (variant × size)</SubHead>
			<SidebarProvider className="min-h-0">
				<Matrix corner="variant / size" rows={["default", "outline"] as const} cols={["default", "sm", "lg"] as const} cell={(r, c) => (
					<SidebarMenu className="w-48"><SidebarMenuItem><SidebarMenuButton variant={r} size={c}>Home</SidebarMenuButton></SidebarMenuItem></SidebarMenu>
				)} />
			</SidebarProvider>
			<p className="text-sm text-muted-foreground">Below 768px the stock sidebar is a sheet, so these frames show their inline form from the md breakpoint up.</p>
			<SubHead>Variant (expanded; each frame's trigger collapses it)</SubHead>
			<div className="grid gap-3 md:grid-cols-3">
				{(["sidebar", "floating", "inset"] as const).map((v) => (
					<SidebarFrame key={v} label={"variant=" + v + " · expanded"} variant={v} collapsible="icon" open trigger />
				))}
			</div>
			<SubHead>Collapsible (offcanvas and icon, expanded and collapsed; none ignores state)</SubHead>
			<div className="grid gap-3 md:grid-cols-3">
				<SidebarFrame label="collapsible=offcanvas · expanded" collapsible="offcanvas" open trigger />
				<SidebarFrame label="collapsible=offcanvas · collapsed" collapsible="offcanvas" open={false} trigger />
				<SidebarFrame label="collapsible=icon · expanded" collapsible="icon" open trigger />
				<SidebarFrame label="collapsible=icon · collapsed" collapsible="icon" open={false} trigger />
				<SidebarFrame label="collapsible=none · static: no state, no trigger" collapsible="none" open />
			</div>
			<SubHead>Side (expanded)</SubHead>
			<div className="grid gap-3 md:grid-cols-2">
				{(["left", "right"] as const).map((s) => (
					<SidebarFrame key={s} label={"side=" + s + " · static: no trigger"} collapsible="icon" side={s} open />
				))}
			</div>
		</div>
	),
	sonner: (
		<Row label="kind">
			{(["toast", "success", "error", "info", "warning", "loading"] as const).map((k) => (
				<Button key={k} variant="outline" size="sm" onClick={() => (k === "toast" ? toast("Event") : toast[k]("Message " + k))}>{k}</Button>
			))}
		</Row>
	),
	tabs: (
		<Matrix corner="variant / orientation" rows={["default", "line"] as const} cols={["horizontal", "vertical"] as const} cell={(r, c) => (
			<Tabs defaultValue="a" orientation={c}>
				<TabsList variant={r}><TabsTrigger value="a">Account</TabsTrigger><TabsTrigger value="b">Team</TabsTrigger></TabsList>
			</Tabs>
		)} />
	),
	"toggle-group": (
		<div className="flex flex-col gap-4">
			<Matrix corner="variant / orientation" rows={["default", "outline"] as const} cols={["horizontal", "vertical"] as const} cell={(r, c) => (
				<ToggleGroup type="single" variant={r} orientation={c} defaultValue="l">
					<ToggleGroupItem value="l" aria-label="Left">L</ToggleGroupItem>
					<ToggleGroupItem value="c" aria-label="Centre">C</ToggleGroupItem>
					<ToggleGroupItem value="r" aria-label="Right">R</ToggleGroupItem>
				</ToggleGroup>
			)} />
			<div className="flex flex-col divide-y">
				{(["sm", "default", "lg"] as const).map((s) => (
					<Row key={s} label={"size=" + s}>
						<ToggleGroup type="single" size={s} defaultValue="c">
							<ToggleGroupItem value="c" aria-label="Centre">C</ToggleGroupItem>
							<ToggleGroupItem value="r" aria-label="Right">R</ToggleGroupItem>
						</ToggleGroup>
					</Row>
				))}
			</div>
		</div>
	),
	toggle: (
		<Matrix corner="variant / size" rows={["default", "outline"] as const} cols={["default", "sm", "lg"] as const} cell={(r, c) => (
			<Toggle variant={r} size={c} aria-label={r + " " + c}>B</Toggle>
		)} />
	),
	trace: (
		<div className="flex flex-col divide-y">
			{(["running", "pending", "error"] as const).map((s) => (
				<Row key={s} label={"status=" + s}>
					<Trace className="w-full max-w-md"><TraceLine status={s}><TraceIcon>◌</TraceIcon><TraceTitle>Build step</TraceTitle></TraceLine></Trace>
				</Row>
			))}
		</div>
	),
};

export const STATES: Record<string, React.ReactNode> = {
	accordion: (
		<Accordion type="single" collapsible className="w-full max-w-md">
			<AccordionItem value="a" disabled><AccordionTrigger>Disabled item</AccordionTrigger><AccordionContent>Hidden.</AccordionContent></AccordionItem>
			<AccordionItem value="b"><AccordionTrigger>Enabled item</AccordionTrigger><AccordionContent>Shown on open.</AccordionContent></AccordionItem>
		</Accordion>
	),
	button: states(
		<Cell key="d" label="default"><Button>Save</Button></Cell>,
		<Cell key="h" label="hover (live: move the pointer over it)"><Button>Save</Button></Cell>,
		<Cell key="f" label="focus-visible (live: press Tab to reach it)"><Button>Save</Button></Cell>,
		<Cell key="a" label="active (live: hold the mouse button down)"><Button>Save</Button></Cell>,
		<Cell key="x" label="disabled"><Button disabled>Save</Button></Cell>,
		<Cell key="l" label="loading (stock spinner in the button)"><Button disabled><Spinner data-icon="inline-start" />Saving</Button></Cell>,
	),
	checkbox: states(
		<Cell key="u" label="unchecked"><Checkbox /></Cell>,
		<Cell key="c" label="checked"><Checkbox defaultChecked /></Cell>,
		<Cell key="du" label="disabled"><Checkbox disabled /></Cell>,
		<Cell key="dc" label="disabled, checked"><Checkbox disabled defaultChecked /></Cell>,
		<Cell key="i" label="invalid"><Checkbox aria-invalid /></Cell>,
	),
	field: states(
		<Cell key="f" label="invalid">
			<Field data-invalid className="w-64">
				<FieldLabel htmlFor="field-invalid">Email</FieldLabel>
				<Input id="field-invalid" aria-invalid defaultValue="not-an-email" />
				<FieldError>Enter a valid email.</FieldError>
			</Field>
		</Cell>,
	),
	input: states(
		<Cell key="d" label="default"><Input placeholder="Type here" className="w-56" /></Cell>,
		<Cell key="x" label="disabled"><Input disabled placeholder="Disabled" className="w-56" /></Cell>,
		<Cell key="i" label="invalid"><Input aria-invalid defaultValue="bad value" className="w-56" /></Cell>,
	),
	"input-group": states(
		<Cell key="x" label="disabled"><InputGroup className="w-56"><InputGroupInput disabled placeholder="Disabled" /></InputGroup></Cell>,
	),
	"native-select": states(
		<Cell key="x" label="disabled"><NativeSelect disabled defaultValue="a" className="w-48"><NativeSelectOption value="a">Option A</NativeSelectOption></NativeSelect></Cell>,
	),
	progress: states(
		<Cell key="0" label="value 0"><Progress value={0} className="w-40" /></Cell>,
		<Cell key="50" label="value 50"><Progress value={50} className="w-40" /></Cell>,
		<Cell key="100" label="value 100"><Progress value={100} className="w-40" /></Cell>,
	),
	"radio-group": states(
		<Cell key="u" label="unchecked">
			<RadioGroup><div className="flex items-center gap-2"><RadioGroupItem value="a" id="rs-u" /><label htmlFor="rs-u" className="text-sm">Unchecked</label></div></RadioGroup>
		</Cell>,
		<Cell key="c" label="checked">
			<RadioGroup defaultValue="a"><div className="flex items-center gap-2"><RadioGroupItem value="a" id="rs-c" /><label htmlFor="rs-c" className="text-sm">Checked</label></div></RadioGroup>
		</Cell>,
		<Cell key="d" label="disabled">
			<RadioGroup disabled><div className="flex items-center gap-2"><RadioGroupItem value="a" id="rs-d" /><label htmlFor="rs-d" className="text-sm">Disabled</label></div></RadioGroup>
		</Cell>,
	),
	select: states(
		<Cell key="x" label="disabled">
			<Select disabled defaultValue="light"><SelectTrigger className="w-48"><SelectValue placeholder="Mode" /></SelectTrigger><SelectContent><SelectItem value="light">Light</SelectItem></SelectContent></Select>
		</Cell>,
	),
	slider: states(
		<Cell key="d" label="default"><Slider defaultValue={[40]} max={100} step={1} className="w-56" /></Cell>,
		<Cell key="x" label="disabled"><Slider disabled defaultValue={[40]} max={100} step={1} className="w-56" /></Cell>,
	),
	switch: states(
		<Cell key="off" label="off"><Switch /></Cell>,
		<Cell key="on" label="on"><Switch defaultChecked /></Cell>,
		<Cell key="doff" label="disabled, off"><Switch disabled /></Cell>,
		<Cell key="don" label="disabled, on"><Switch disabled defaultChecked /></Cell>,
	),
	tabs: (
		<Tabs defaultValue="a">
			<TabsList><TabsTrigger value="a">Enabled</TabsTrigger><TabsTrigger value="b" disabled>Disabled</TabsTrigger></TabsList>
		</Tabs>
	),
	textarea: states(
		<Cell key="d" label="default"><Textarea placeholder="Write a note" className="w-56" /></Cell>,
		<Cell key="x" label="disabled"><Textarea disabled placeholder="Disabled" className="w-56" /></Cell>,
		<Cell key="i" label="invalid"><Textarea aria-invalid defaultValue="too short" className="w-56" /></Cell>,
	),
	toggle: states(
		<Cell key="off" label="unpressed"><Toggle variant="outline" aria-label="Bold">B</Toggle></Cell>,
		<Cell key="on" label="pressed"><Toggle variant="outline" aria-label="Bold" defaultPressed>B</Toggle></Cell>,
		<Cell key="x" label="disabled"><Toggle variant="outline" aria-label="Bold" disabled>B</Toggle></Cell>,
	),
	"toggle-group": states(
		<Cell key="x" label="one item disabled">
			<ToggleGroup type="single" variant="outline" defaultValue="l">
				<ToggleGroupItem value="l" aria-label="Left">L</ToggleGroupItem>
				<ToggleGroupItem value="r" aria-label="Right" disabled>R</ToggleGroupItem>
			</ToggleGroup>
		</Cell>,
	),
};
