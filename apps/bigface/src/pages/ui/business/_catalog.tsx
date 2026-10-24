import * as React from "react";
import { ColourSection } from "./_colour.tsx";
import { VARIANTS, STATES } from "./_variants.tsx";
import { PARTS } from "./_parts.ts";
import { Rail } from "./_rail.tsx";
import { TypographySection } from "./_typography.tsx";
import { cn } from "@gjuoun/bigface-business-ui/lib/utils";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@gjuoun/bigface-business-ui/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@gjuoun/bigface-business-ui/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@gjuoun/bigface-business-ui/components/ui/alert";
import { AspectRatio } from "@gjuoun/bigface-business-ui/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@gjuoun/bigface-business-ui/components/ui/avatar";
import { Badge } from "@gjuoun/bigface-business-ui/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@gjuoun/bigface-business-ui/components/ui/breadcrumb";
import { Button } from "@gjuoun/bigface-business-ui/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@gjuoun/bigface-business-ui/components/ui/button-group";
import { Calendar } from "@gjuoun/bigface-business-ui/components/ui/calendar";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@gjuoun/bigface-business-ui/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@gjuoun/bigface-business-ui/components/ui/carousel";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@gjuoun/bigface-business-ui/components/ui/chart";
import { Checkbox } from "@gjuoun/bigface-business-ui/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@gjuoun/bigface-business-ui/components/ui/collapsible";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@gjuoun/bigface-business-ui/components/ui/combobox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@gjuoun/bigface-business-ui/components/ui/command";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@gjuoun/bigface-business-ui/components/ui/context-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@gjuoun/bigface-business-ui/components/ui/dialog";
import { DirectionProvider } from "@gjuoun/bigface-business-ui/components/ui/direction";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@gjuoun/bigface-business-ui/components/ui/drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@gjuoun/bigface-business-ui/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@gjuoun/bigface-business-ui/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@gjuoun/bigface-business-ui/components/ui/field";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@gjuoun/bigface-business-ui/components/ui/hover-card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@gjuoun/bigface-business-ui/components/ui/input-group";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@gjuoun/bigface-business-ui/components/ui/input-otp";
import { Input } from "@gjuoun/bigface-business-ui/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@gjuoun/bigface-business-ui/components/ui/item";
import { Kbd, KbdGroup } from "@gjuoun/bigface-business-ui/components/ui/kbd";
import { Label } from "@gjuoun/bigface-business-ui/components/ui/label";
import { Marker, MarkerContent, MarkerIcon } from "@gjuoun/bigface-business-ui/components/ui/marker";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from "@gjuoun/bigface-business-ui/components/ui/menubar";
import { useMode } from "@gjuoun/bigface-business-ui/hooks/use-theme";
import { ToggleGroup, ToggleGroupItem } from "@gjuoun/bigface-business-ui/components/ui/toggle-group";
import { Toaster } from "@gjuoun/bigface-business-ui/components/ui/sonner";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader } from "@gjuoun/bigface-business-ui/components/ui/message";
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from "@gjuoun/bigface-business-ui/components/ui/bubble";
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentGroup, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from "@gjuoun/bigface-business-ui/components/ui/attachment";
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockCopyButton, CodeBlockFooter, CodeBlockHeader, CodeBlockLine, CodeBlockTitle } from "@gjuoun/bigface-business-ui/components/ui/code-block";
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from "@gjuoun/bigface-business-ui/components/ui/message-scroller";
import { NativeSelect, NativeSelectOption } from "@gjuoun/bigface-business-ui/components/ui/native-select";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@gjuoun/bigface-business-ui/components/ui/navigation-menu";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@gjuoun/bigface-business-ui/components/ui/pagination";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@gjuoun/bigface-business-ui/components/ui/popover";
import { Progress } from "@gjuoun/bigface-business-ui/components/ui/progress";
import { Questionnaire, QuestionnaireChoice, QuestionnaireChoices, QuestionnaireDescription, QuestionnaireItem, QuestionnaireProgress, QuestionnaireTitle } from "@gjuoun/bigface-business-ui/components/ui/questionnaire";
import { RadioGroup, RadioGroupItem } from "@gjuoun/bigface-business-ui/components/ui/radio-group";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@gjuoun/bigface-business-ui/components/ui/resizable";
import { ScrollArea } from "@gjuoun/bigface-business-ui/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@gjuoun/bigface-business-ui/components/ui/select";
import { Separator } from "@gjuoun/bigface-business-ui/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@gjuoun/bigface-business-ui/components/ui/sheet";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@gjuoun/bigface-business-ui/components/ui/sidebar";
import { Skeleton } from "@gjuoun/bigface-business-ui/components/ui/skeleton";
import { Slider } from "@gjuoun/bigface-business-ui/components/ui/slider";
import { Spinner } from "@gjuoun/bigface-business-ui/components/ui/spinner";
import { Switch } from "@gjuoun/bigface-business-ui/components/ui/switch";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@gjuoun/bigface-business-ui/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@gjuoun/bigface-business-ui/components/ui/tabs";
import { Textarea } from "@gjuoun/bigface-business-ui/components/ui/textarea";
import { Toggle } from "@gjuoun/bigface-business-ui/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@gjuoun/bigface-business-ui/components/ui/tooltip";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@gjuoun/bigface-business-ui/components/ui/trace";

// The catalogue: every shadcn component in the business package, each in a live demo. A demo's trigger carries
// data-trigger, the real pointer action that exercises it (click, hover, drag, wheel, contextmenu, focus).
// Components with no inherent interaction are rendered as they are, with no data-trigger, and listed as static.
export const STATIC_DEMOS = ["alert", "aspect-ratio", "avatar", "badge", "breadcrumb", "bubble", "button-group", "card", "empty", "item", "kbd", "marker", "message", "separator", "skeleton", "spinner", "table"] as const;

function Section({ id, title, source, children }: { id: string; title: string; source: string; children: React.ReactNode }) {
	return (
		<section id={id} className="flex scroll-mt-6 flex-col gap-5 rounded-xl border bg-card p-5 text-card-foreground">
			<header className="flex flex-col gap-1">
				<h3 className="text-lg font-semibold text-foreground">{title}</h3>
				<code className="font-mono text-xs text-muted-foreground">{source}</code>
			</header>
			<Group label="Variants">{VARIANTS[id] ?? <Note>No variant axis is declared in the source; the examples show its one form.</Note>}</Group>
			<Group label="States">{STATES[id] ?? <Note>No stateful props. Hover and focus are live in the examples.</Note>}</Group>
			<Group label="Examples">{children}</Group>
			<details className="text-sm">
				<summary className="cursor-pointer font-mono text-xs text-muted-foreground">Exports</summary>
				<p className="mt-2 font-mono text-xs break-words text-muted-foreground">{PARTS[id] ?? ""}</p>
			</details>
		</section>
	);
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-1">
			<h4 className="border-b pb-1 text-xs font-semibold tracking-[0.08em] text-foreground uppercase">{label}</h4>
			{children}
		</div>
	);
}

function Note({ children }: { children: React.ReactNode }) {
	return <p className="py-2 text-sm text-muted-foreground">{children}</p>;
}

function Category({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
	return (
		<div id={id} className="flex scroll-mt-6 flex-col gap-6">
			<header className="flex flex-col gap-1 border-t border-border pt-8">
				<p className="font-mono text-xs tracking-[0.06em] text-muted-foreground uppercase">{count} components</p>
				<h2 className="text-2xl font-semibold text-foreground">{title}</h2>
			</header>
			{children}
		</div>
	);
}

function Demo({ name, className, children }: { name: string; className?: string; children: React.ReactNode }) {
	return (
		<div data-demo={name} className={cn("flex min-h-24 flex-wrap items-center gap-3 rounded-md border p-4", className)}>
			{children}
		</div>
	);
}

const frameworks = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"];
const feed = Array.from({ length: 18 }, (_, i) => "Release note " + (i + 1));


/** Light and dark for this page: writes data-mode on the page root, which every colour follows. */
function ModeSwitch() {
	const { mode, setMode } = useMode();
	return (
		<ToggleGroup
			type="single"
			variant="outline"
			value={mode}
			aria-label="Colour mode"
			onValueChange={(next) => {
				if (next === "light" || next === "dark") setMode(next);
			}}
		>
			<ToggleGroupItem value="light">Light</ToggleGroupItem>
			<ToggleGroupItem value="dark">Dark</ToggleGroupItem>
		</ToggleGroup>
	);
}

export function Catalog() {
	const [clicks, setClicks] = React.useState(0);
	const [progress, setProgress] = React.useState(30);
	const [date, setDate] = React.useState<Date | undefined>(new Date(2026, 9, 24));
	const [dir, setDir] = React.useState<"ltr" | "rtl">("ltr");
	const [picked, setPicked] = React.useState("none");
	const [copied, setCopied] = React.useState(false);
	const [preview, setPreview] = React.useState<string | null>(null);

	return (
		<TooltipProvider>
			<div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
				<Rail />
				<div className="flex min-w-0 flex-col gap-10">
				<div className="flex flex-wrap items-center gap-3"><ModeSwitch /><span className="font-mono text-xs text-muted-foreground">every colour follows this switch; the components are unchanged</span></div>
				<ColourSection />
				<TypographySection />
				<Category id="cat-actions" title="Actions" count={4}>
				<Section id="button" title="Button" source="components/ui/button">
					<Demo name="button">
						<Button data-trigger="click" onClick={() => setClicks((n) => n + 1)}>Clicked {clicks}×</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="outline">Outline</Button>
						<Button variant="ghost">Ghost</Button>
						<Button variant="destructive">Destructive</Button>
						<Button variant="link">Link</Button>
						<Button size="sm">Small</Button>
						<Button size="lg">Large</Button>
					</Demo>
				</Section>

				<Section id="button-group" title="Button group" source="components/ui/button-group">
					<Demo name="button-group">
						<ButtonGroup>
							<Button variant="outline">Left</Button>
							<Button variant="outline">Middle</Button>
							<ButtonGroupText>Right</ButtonGroupText>
						</ButtonGroup>
					</Demo>
				</Section>

				<Section id="toggle" title="Toggle" source="components/ui/toggle">
					<Demo name="toggle">
						<Toggle variant="outline" aria-label="Bold" data-trigger="click">B</Toggle>
					</Demo>
				</Section>

				<Section id="toggle-group" title="Toggle group" source="components/ui/toggle-group">
					<Demo name="toggle-group">
						<ToggleGroup type="single" defaultValue="left" variant="outline">
							<ToggleGroupItem value="left" aria-label="Align left">L</ToggleGroupItem>
							<ToggleGroupItem value="center" aria-label="Align centre" data-trigger="click">C</ToggleGroupItem>
							<ToggleGroupItem value="right" aria-label="Align right">R</ToggleGroupItem>
						</ToggleGroup>
					</Demo>
				</Section>
				</Category>

				<Category id="cat-forms" title="Forms" count={14}>
				<Section id="calendar" title="Calendar" source="components/ui/calendar">
					<Demo name="calendar">
						<Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" data-trigger="click" />
						<p className="text-sm text-muted-foreground">Selected: {date ? date.toDateString() : "none"}</p>
					</Demo>
				</Section>

				<Section id="checkbox" title="Checkbox" source="components/ui/checkbox">
					<Demo name="checkbox">
						<label className="flex items-center gap-2 text-sm">
							<Checkbox data-trigger="click" /> Accept the terms
						</label>
					</Demo>
				</Section>

				<Section id="combobox" title="Combobox" source="components/ui/combobox">
					<Demo name="combobox">
						<Combobox items={frameworks}>
							<ComboboxInput placeholder="Pick a framework" className="w-64" data-trigger="click" />
							<ComboboxContent>
								<ComboboxEmpty>No framework found.</ComboboxEmpty>
								<ComboboxList>
									{(item: string) => (
										<ComboboxItem key={item} value={item}>{item}</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					</Demo>
				</Section>

				<Section id="field" title="Field" source="components/ui/field">
					<Demo name="field" className="block">
						<FieldSet className="w-full max-w-sm">
							<FieldLegend>Account</FieldLegend>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="field-email">Email</FieldLabel>
									<Input id="field-email" type="email" placeholder="you@example.com" data-trigger="focus" />
									<FieldDescription>We will never share it.</FieldDescription>
									<FieldError>Enter a valid email.</FieldError>
								</Field>
							</FieldGroup>
						</FieldSet>
					</Demo>
				</Section>

				<Section id="input" title="Input" source="components/ui/input">
					<Demo name="input">
						<Input placeholder="Type here" className="w-64" data-trigger="focus" />
						<Input disabled placeholder="Disabled" className="w-64" />
					</Demo>
				</Section>

				<Section id="input-group" title="Input group" source="components/ui/input-group">
					<Demo name="input-group">
						<InputGroup className="w-full max-w-sm">
							<InputGroupAddon><InputGroupText>https://</InputGroupText></InputGroupAddon>
							<InputGroupInput placeholder="example.com" data-trigger="focus" />
							<InputGroupAddon align="inline-end"><InputGroupButton>Go</InputGroupButton></InputGroupAddon>
						</InputGroup>
					</Demo>
				</Section>

				<Section id="input-otp" title="Input OTP" source="components/ui/input-otp">
					<Demo name="input-otp">
						<InputOTP maxLength={6} data-trigger="click">
							<InputOTPGroup>
								<InputOTPSlot index={0} />
								<InputOTPSlot index={1} />
								<InputOTPSlot index={2} />
							</InputOTPGroup>
							<InputOTPSeparator />
							<InputOTPGroup>
								<InputOTPSlot index={3} />
								<InputOTPSlot index={4} />
								<InputOTPSlot index={5} />
							</InputOTPGroup>
						</InputOTP>
					</Demo>
				</Section>

				<Section id="label" title="Label" source="components/ui/label">
					<Demo name="label">
						<Label htmlFor="label-name" data-trigger="focus">Name</Label>
						<Input id="label-name" placeholder="Ada" className="w-64" />
					</Demo>
				</Section>

				<Section id="native-select" title="Native select" source="components/ui/native-select">
					<Demo name="native-select">
						<NativeSelect data-trigger="focus" defaultValue="a" className="w-48">
							<NativeSelectOption value="a">Option A</NativeSelectOption>
							<NativeSelectOption value="b">Option B</NativeSelectOption>
						</NativeSelect>
					</Demo>
				</Section>

				<Section id="radio-group" title="Radio group" source="components/ui/radio-group">
					<Demo name="radio-group">
						<RadioGroup defaultValue="comfortable">
							<div className="flex items-center gap-2"><RadioGroupItem value="default" id="rg-default" /><Label htmlFor="rg-default">Default</Label></div>
							<div className="flex items-center gap-2"><RadioGroupItem value="comfortable" id="rg-comfortable" /><Label htmlFor="rg-comfortable">Comfortable</Label></div>
							<div className="flex items-center gap-2"><RadioGroupItem value="compact" id="rg-compact" data-trigger="click" /><Label htmlFor="rg-compact">Compact</Label></div>
						</RadioGroup>
					</Demo>
				</Section>

				<Section id="select" title="Select" source="components/ui/select">
					<Demo name="select">
						<Select defaultValue="light">
							<SelectTrigger data-trigger="click" className="w-48">
								<SelectValue placeholder="Mode" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectLabel>Mode</SelectLabel>
									<SelectItem value="light">Light</SelectItem>
									<SelectItem value="dark">Dark</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
					</Demo>
				</Section>

				<Section id="slider" title="Slider" source="components/ui/slider">
					<Demo name="slider">
						<Slider data-trigger="drag" defaultValue={[40]} max={100} step={1} className="w-64" />
					</Demo>
				</Section>

				<Section id="switch" title="Switch" source="components/ui/switch">
					<Demo name="switch">
						<label className="flex items-center gap-2 text-sm">
							<Switch data-trigger="click" /> Notifications
						</label>
					</Demo>
				</Section>

				<Section id="textarea" title="Textarea" source="components/ui/textarea">
					<Demo name="textarea">
						<Textarea placeholder="Write a note" className="w-64" data-trigger="focus" />
					</Demo>
				</Section>
				</Category>

				<Category id="cat-navigation" title="Navigation" count={7}>
				<Section id="breadcrumb" title="Breadcrumb" source="components/ui/breadcrumb">
					<Demo name="breadcrumb">
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem><BreadcrumbLink href="#ui">Components</BreadcrumbLink></BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem><BreadcrumbPage>Breadcrumb</BreadcrumbPage></BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</Demo>
				</Section>

				<Section id="command" title="Command" source="components/ui/command">
					<Demo name="command">
						<Command className="w-full max-w-sm rounded-lg border">
							<CommandInput placeholder="Type a command" />
							<CommandList>
								<CommandEmpty>No results.</CommandEmpty>
								<CommandGroup heading="Actions">
									<CommandItem data-trigger="click" onSelect={() => setPicked("deploy")}>
										Deploy <CommandShortcut>⌘D</CommandShortcut>
									</CommandItem>
									<CommandItem onSelect={() => setPicked("rollback")}>Roll back</CommandItem>
								</CommandGroup>
							</CommandList>
						</Command>
						<p className="text-sm text-muted-foreground">Last command: {picked}</p>
					</Demo>
				</Section>

				<Section id="menubar" title="Menubar" source="components/ui/menubar">
					<Demo name="menubar">
						<Menubar>
							<MenubarMenu>
								<MenubarTrigger data-trigger="click">File</MenubarTrigger>
								<MenubarContent>
									<MenubarItem>New tab</MenubarItem>
									<MenubarSeparator />
									<MenubarItem>Print</MenubarItem>
								</MenubarContent>
							</MenubarMenu>
							<MenubarMenu>
								<MenubarTrigger>Edit</MenubarTrigger>
								<MenubarContent><MenubarItem>Undo</MenubarItem></MenubarContent>
							</MenubarMenu>
						</Menubar>
					</Demo>
				</Section>

				<Section id="navigation-menu" title="Navigation menu" source="components/ui/navigation-menu">
					<Demo name="navigation-menu">
						<NavigationMenu>
							<NavigationMenuList>
								<NavigationMenuItem>
									<NavigationMenuTrigger data-trigger="click">Getting started</NavigationMenuTrigger>
									<NavigationMenuContent>
										<NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>Introduction</NavigationMenuLink>
									</NavigationMenuContent>
								</NavigationMenuItem>
							</NavigationMenuList>
						</NavigationMenu>
					</Demo>
				</Section>

				<Section id="pagination" title="Pagination" source="components/ui/pagination">
					<Demo name="pagination">
						<PagerDemo />
					</Demo>
				</Section>

				<Section id="sidebar" title="Sidebar" source="components/ui/sidebar">
					<Demo name="sidebar" className="block h-72 overflow-hidden p-0 [transform:translateZ(0)]">
						<SidebarProvider className="h-full min-h-0">
							<Sidebar collapsible="icon">
								<SidebarContent>
									<SidebarGroup>
										<SidebarGroupLabel>Workspace</SidebarGroupLabel>
										<SidebarMenu>
											<SidebarMenuItem><SidebarMenuButton>Home</SidebarMenuButton></SidebarMenuItem>
											<SidebarMenuItem><SidebarMenuButton>Projects</SidebarMenuButton></SidebarMenuItem>
										</SidebarMenu>
									</SidebarGroup>
								</SidebarContent>
							</Sidebar>
							<SidebarInset className="p-4">
								<SidebarTrigger data-trigger="click" />
								<p className="mt-2 text-sm text-muted-foreground">Toggle the sidebar.</p>
							</SidebarInset>
						</SidebarProvider>
					</Demo>
				</Section>

				<Section id="tabs" title="Tabs" source="components/ui/tabs">
					<Demo name="tabs" className="block">
						<Tabs defaultValue="account" className="w-full max-w-md">
							<TabsList>
								<TabsTrigger value="account">Account</TabsTrigger>
								<TabsTrigger value="password" data-trigger="click">Password</TabsTrigger>
							</TabsList>
							<TabsContent value="account" className="text-sm">Make changes to your account.</TabsContent>
							<TabsContent value="password" className="text-sm">Change your password.</TabsContent>
						</Tabs>
					</Demo>
				</Section>
				</Category>

				<Category id="cat-overlays" title="Overlays" count={9}>
				<Section id="alert-dialog" title="Alert dialog" source="components/ui/alert-dialog">
					<Demo name="alert-dialog">
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="outline" data-trigger="click">Delete project</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Are you sure?</AlertDialogTitle>
									<AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction>Delete</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</Demo>
				</Section>

				<Section id="context-menu" title="Context menu" source="components/ui/context-menu">
					<Demo name="context-menu">
						<ContextMenu>
							<ContextMenuTrigger data-trigger="contextmenu" className="flex h-32 w-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
								Right-click here
							</ContextMenuTrigger>
							<ContextMenuContent>
								<ContextMenuLabel>Document</ContextMenuLabel>
								<ContextMenuItem>Copy <ContextMenuShortcut>⌘C</ContextMenuShortcut></ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem>Delete</ContextMenuItem>
							</ContextMenuContent>
						</ContextMenu>
					</Demo>
				</Section>

				<Section id="dialog" title="Dialog" source="components/ui/dialog">
					<Demo name="dialog">
						<Dialog>
							<DialogTrigger asChild>
								<Button variant="outline" data-trigger="click">Edit profile</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Edit profile</DialogTitle>
									<DialogDescription>Make changes to your profile.</DialogDescription>
								</DialogHeader>
								<Input placeholder="Display name" />
								<DialogFooter><Button>Save</Button></DialogFooter>
							</DialogContent>
						</Dialog>
					</Demo>
				</Section>

				<Section id="drawer" title="Drawer" source="components/ui/drawer">
					<Demo name="drawer">
						<Drawer>
							<DrawerTrigger asChild>
								<Button variant="outline" data-trigger="click">Open drawer</Button>
							</DrawerTrigger>
							<DrawerContent>
								<DrawerHeader>
									<DrawerTitle>Move goal</DrawerTitle>
									<DrawerDescription>Set your daily goal.</DrawerDescription>
								</DrawerHeader>
								<DrawerFooter><Button>Submit</Button></DrawerFooter>
							</DrawerContent>
						</Drawer>
					</Demo>
				</Section>

				<Section id="dropdown-menu" title="Dropdown menu" source="components/ui/dropdown-menu">
					<Demo name="dropdown-menu">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" data-trigger="click">Open menu</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								<DropdownMenuLabel>Account</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									<DropdownMenuItem>Profile <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut></DropdownMenuItem>
									<DropdownMenuItem>Settings</DropdownMenuItem>
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</Demo>
				</Section>

				<Section id="hover-card" title="Hover card" source="components/ui/hover-card">
					<Demo name="hover-card">
						<HoverCard>
							<HoverCardTrigger asChild>
								<Button variant="link" data-trigger="hover">@gjuoun</Button>
							</HoverCardTrigger>
							<HoverCardContent className="w-64 text-sm">Maintainer of the Bigface packages.</HoverCardContent>
						</HoverCard>
					</Demo>
				</Section>

				<Section id="popover" title="Popover" source="components/ui/popover">
					<Demo name="popover">
						<Popover>
							<PopoverTrigger asChild>
								<Button variant="outline" data-trigger="click">Open popover</Button>
							</PopoverTrigger>
							<PopoverContent className="w-64">
								<PopoverHeader>
									<PopoverTitle>Dimensions</PopoverTitle>
									<PopoverDescription>Set the size of the layer.</PopoverDescription>
								</PopoverHeader>
							</PopoverContent>
						</Popover>
					</Demo>
				</Section>

				<Section id="sheet" title="Sheet" source="components/ui/sheet">
					<Demo name="sheet">
						<Sheet>
							<SheetTrigger asChild>
								<Button variant="outline" data-trigger="click">Open sheet</Button>
							</SheetTrigger>
							<SheetContent>
								<SheetHeader>
									<SheetTitle>Settings</SheetTitle>
									<SheetDescription>Adjust the workspace.</SheetDescription>
								</SheetHeader>
								<SheetFooter><Button>Done</Button></SheetFooter>
							</SheetContent>
						</Sheet>
					</Demo>
				</Section>

				<Section id="tooltip" title="Tooltip" source="components/ui/tooltip">
					<Demo name="tooltip">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" data-trigger="hover">Hover me</Button>
							</TooltipTrigger>
							<TooltipContent>Shown after a short delay.</TooltipContent>
						</Tooltip>
					</Demo>
				</Section>
				</Category>

				<Category id="cat-layout" title="Layout and disclosure" count={9}>
				<Section id="accordion" title="Accordion" source="@gjuoun/bigface-business-ui/components/ui/accordion">
					<Demo name="accordion" className="block">
						<Accordion type="single" collapsible className="w-full max-w-md">
							<AccordionItem value="a">
								<AccordionTrigger data-trigger="click">What is it?</AccordionTrigger>
								<AccordionContent>The stock shadcn accordion, with the business colours.</AccordionContent>
							</AccordionItem>
							<AccordionItem value="b">
								<AccordionTrigger>Is the look changed?</AccordionTrigger>
								<AccordionContent>No. Only the colour is the theme's; the component is unchanged.</AccordionContent>
							</AccordionItem>
						</Accordion>
					</Demo>
				</Section>

				<Section id="aspect-ratio" title="Aspect ratio" source="components/ui/aspect-ratio">
					<Demo name="aspect-ratio" className="block">
						<div className="w-64">
							<AspectRatio ratio={16 / 9} className="flex items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
								16 : 9
							</AspectRatio>
						</div>
					</Demo>
				</Section>

				<Section id="carousel" title="Carousel" source="components/ui/carousel">
					<Demo name="carousel">
						<Carousel className="mx-12 w-[calc(100%-6rem)] max-w-xs">
							<CarouselContent>
								{["One", "Two", "Three", "Four"].map((label) => (
									<CarouselItem key={label}>
										<div className="flex h-40 items-center justify-center rounded-md border text-2xl font-semibold">{label}</div>
									</CarouselItem>
								))}
							</CarouselContent>
							<CarouselPrevious />
							<CarouselNext data-trigger="click" />
						</Carousel>
					</Demo>
				</Section>

				<Section id="card" title="Card" source="components/ui/card">
					<Demo name="card">
						<Card className="w-full max-w-sm">
							<CardHeader>
								<CardTitle>Workspace</CardTitle>
								<CardDescription>Stock card, colour only.</CardDescription>
								<CardAction><Button variant="ghost" size="sm">Edit</Button></CardAction>
							</CardHeader>
							<CardContent>Content goes here.</CardContent>
							<CardFooter><Button size="sm">Save</Button></CardFooter>
						</Card>
					</Demo>
				</Section>

				<Section id="collapsible" title="Collapsible" source="components/ui/collapsible">
					<Demo name="collapsible">
						<Collapsible className="w-full max-w-sm">
							<CollapsibleTrigger asChild>
								<Button variant="outline" data-trigger="click">Show details</Button>
							</CollapsibleTrigger>
							<CollapsibleContent className="pt-2 text-sm">Hidden until you open it.</CollapsibleContent>
						</Collapsible>
					</Demo>
				</Section>

				<Section id="direction" title="Direction" source="components/ui/direction">
					<Demo name="direction">
						<DirectionProvider dir={dir}>
							<div dir={dir} className="flex w-64 flex-col gap-2 rounded-md border p-3 text-sm">
								<Button variant="outline" data-trigger="click" onClick={() => setDir((d) => (d === "ltr" ? "rtl" : "ltr"))}>Direction: {dir}</Button>
								<p>Reading direction follows the provider.</p>
							</div>
						</DirectionProvider>
					</Demo>
				</Section>

				<Section id="resizable" title="Resizable" source="components/ui/resizable">
					<Demo name="resizable" className="block">
						<ResizablePanelGroup orientation="horizontal" className="h-40 w-full max-w-md rounded-lg border">
							<ResizablePanel defaultSize={40} className="flex items-center justify-center p-3 text-sm">Left</ResizablePanel>
							<ResizableHandle data-trigger="drag" withHandle />
							<ResizablePanel defaultSize={60} className="flex items-center justify-center p-3 text-sm">Right</ResizablePanel>
						</ResizablePanelGroup>
					</Demo>
				</Section>

				<Section id="scroll-area" title="Scroll area" source="components/ui/scroll-area">
					<Demo name="scroll-area">
						<ScrollArea data-trigger="wheel" className="h-40 w-64 rounded-md border p-3">
							{feed.map((m) => (
								<div key={m} className="py-1 text-sm">{m}</div>
							))}
						</ScrollArea>
					</Demo>
				</Section>

				<Section id="separator" title="Separator" source="components/ui/separator">
					<Demo name="separator" className="block">
						<div className="w-64">
							<p className="text-sm">Above</p>
							<Separator className="my-3" />
							<p className="text-sm">Below</p>
						</div>
					</Demo>
				</Section>
				</Category>

				<Category id="cat-feedback" title="Feedback" count={7}>
				<Section id="alert" title="Alert" source="components/ui/alert">
					<Demo name="alert" className="block">
						<Alert>
							<AlertTitle>Heads up</AlertTitle>
							<AlertDescription>A static message: an alert has nothing to act on.</AlertDescription>
						</Alert>
					</Demo>
				</Section>

				<Section id="empty" title="Empty" source="components/ui/empty">
					<Demo name="empty" className="block">
						<Empty className="border">
							<EmptyHeader>
								<EmptyMedia variant="icon">∅</EmptyMedia>
								<EmptyTitle>No projects yet</EmptyTitle>
								<EmptyDescription>Create one to get started.</EmptyDescription>
							</EmptyHeader>
							<EmptyContent><Button size="sm">Create project</Button></EmptyContent>
						</Empty>
					</Demo>
				</Section>

				<Section id="marker" title="Marker" source="components/ui/marker">
					<Demo name="marker">
						<Marker variant="default"><MarkerIcon>●</MarkerIcon><MarkerContent>Live</MarkerContent></Marker>
						<Marker variant="border"><MarkerIcon>○</MarkerIcon><MarkerContent>Draft</MarkerContent></Marker>
					</Demo>
				</Section>

				<Section id="progress" title="Progress" source="components/ui/progress">
					<Demo name="progress">
						<Progress value={progress} className="w-64" />
						<Button variant="outline" size="sm" data-trigger="click" onClick={() => setProgress((p) => Math.min(100, p + 20))}>Advance</Button>
					</Demo>
				</Section>

				<Section id="skeleton" title="Skeleton" source="components/ui/skeleton">
					<Demo name="skeleton" className="block">
						<div className="flex w-64 items-center gap-3">
							<Skeleton className="size-10 rounded-full" />
							<div className="flex flex-1 flex-col gap-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div>
						</div>
					</Demo>
				</Section>

				<Section id="sonner" title="Sonner (toast)" source="components/ui/sonner">
					<Demo name="sonner">
						<Button variant="outline" data-trigger="click" onClick={() => toast("Saved", { description: "Your changes are live." })}>Show a toast</Button>
						<Toaster />
					</Demo>
				</Section>

				<Section id="spinner" title="Spinner" source="components/ui/spinner">
					<Demo name="spinner">
						<Spinner />
					</Demo>
				</Section>
				</Category>

				<Category id="cat-data" title="Data display" count={6}>
				<Section id="avatar" title="Avatar" source="components/ui/avatar">
					<Demo name="avatar">
						<AvatarGroup>
							<Avatar><AvatarImage alt="" src="" /><AvatarFallback>JG</AvatarFallback></Avatar>
							<Avatar><AvatarFallback>AB</AvatarFallback></Avatar>
							<AvatarGroupCount>+3</AvatarGroupCount>
						</AvatarGroup>
					</Demo>
				</Section>

				<Section id="badge" title="Badge" source="components/ui/badge">
					<Demo name="badge">
						<Badge>Default</Badge>
						<Badge variant="secondary">Secondary</Badge>
						<Badge variant="outline">Outline</Badge>
						<Badge variant="destructive">Destructive</Badge>
					</Demo>
				</Section>

				<Section id="chart" title="Chart" source="components/ui/chart">
					<Demo name="chart" className="block">
						<div data-trigger="hover" className="w-full max-w-lg">
							<ChartContainer config={chartConfig} className="h-48 w-full">
								<BarChart data={chartData}>
									<CartesianGrid vertical={false} />
									<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
									<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
									<Bar dataKey="visitors" fill="var(--color-visitors)" radius={6} />
								</BarChart>
							</ChartContainer>
						</div>
					</Demo>
				</Section>

				<Section id="item" title="Item" source="components/ui/item">
					<Demo name="item" className="block">
						<Item variant="outline" className="max-w-md">
							<ItemContent>
								<ItemTitle>Basic plan</ItemTitle>
								<ItemDescription>For individuals and side projects.</ItemDescription>
							</ItemContent>
							<ItemActions><Button size="sm" variant="outline">Choose</Button></ItemActions>
						</Item>
					</Demo>
				</Section>

				<Section id="kbd" title="Keyboard key" source="components/ui/kbd">
					<Demo name="kbd">
						<KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup>
					</Demo>
				</Section>

				<Section id="table" title="Table" source="components/ui/table">
					<Demo name="table" className="block">
						<Table className="max-w-md">
							<TableCaption>Recent builds</TableCaption>
							<TableHeader>
								<TableRow><TableHead>Build</TableHead><TableHead>Status</TableHead></TableRow>
							</TableHeader>
							<TableBody>
								<TableRow><TableCell>#41</TableCell><TableCell>passed</TableCell></TableRow>
								<TableRow><TableCell>#42</TableCell><TableCell>passed</TableCell></TableRow>
							</TableBody>
						</Table>
					</Demo>
				</Section>
				</Category>

				<Category id="cat-chat" title="Chat and content" count={7}>
				<Section id="attachment" title="Attachment" source="components/ui/attachment">
					<Demo name="attachment" className="block">
						<AttachmentGroup className="max-w-md">
							<Attachment className="relative">
								<AttachmentMedia>PDF</AttachmentMedia>
								<AttachmentContent>
									<AttachmentTitle>quarterly-report.pdf</AttachmentTitle>
									<AttachmentDescription>2.4 MB</AttachmentDescription>
								</AttachmentContent>
								<AttachmentActions>
									<AttachmentAction>Remove</AttachmentAction>
								</AttachmentActions>
								<AttachmentTrigger data-trigger="click" aria-label="Preview quarterly-report.pdf" onClick={() => setPreview(preview ? null : "quarterly-report.pdf")} />
							</Attachment>
						</AttachmentGroup>
						<p className="text-sm text-muted-foreground">Preview: {preview ?? "closed"}</p>
					</Demo>
				</Section>

				<Section id="bubble" title="Bubble" source="components/ui/bubble">
					<Demo name="bubble" className="block">
						<BubbleGroup className="max-w-md">
							<Bubble align="start"><BubbleContent>Shall we ship the business package?</BubbleContent></Bubble>
							<Bubble align="end"><BubbleContent>Yes, once the gates are green.</BubbleContent><BubbleReactions>+1</BubbleReactions></Bubble>
						</BubbleGroup>
					</Demo>
				</Section>

				<Section id="code-block" title="Code block" source="components/ui/code-block">
					<Demo name="code-block" className="block">
						<CodeBlock className="max-w-lg">
							<CodeBlockHeader>
								<CodeBlockTitle>install.sh</CodeBlockTitle>
								<CodeBlockActions>
									<CodeBlockCopyButton value="bun add @gjuoun/bigface-business-ui" data-trigger="click" onClick={() => setCopied((c) => !c)}>{copied ? "Copied" : "Copy"}</CodeBlockCopyButton>
								</CodeBlockActions>
							</CodeBlockHeader>
							<CodeBlockContent>
								<CodeBlockLine>bun add @gjuoun/bigface-business-ui</CodeBlockLine>
							</CodeBlockContent>
							<CodeBlockFooter>bun</CodeBlockFooter>
						</CodeBlock>
					</Demo>
				</Section>

				<Section id="message" title="Message" source="components/ui/message">
					<Demo name="message" className="block">
						<MessageGroup className="max-w-md">
							<Message>
								<MessageAvatar>JG</MessageAvatar>
								<MessageContent>
									<MessageHeader>Jun</MessageHeader>
									Ship the business package when the gates are green.
									<MessageFooter>10:02</MessageFooter>
								</MessageContent>
							</Message>
						</MessageGroup>
					</Demo>
				</Section>

				<Section id="message-scroller" title="Message scroller" source="components/ui/message-scroller">
					<Demo name="message-scroller">
						<MessageScrollerProvider>
							<MessageScroller className="h-48 w-full max-w-md rounded-md border">
								<MessageScrollerViewport data-trigger="wheel" className="h-full">
									<MessageScrollerContent className="gap-2 p-3">
										{feed.map((m) => (
											<MessageScrollerItem key={m} className="rounded-md bg-muted px-3 py-2 text-sm">{m}</MessageScrollerItem>
										))}
									</MessageScrollerContent>
								</MessageScrollerViewport>
								<MessageScrollerButton>Jump to latest</MessageScrollerButton>
							</MessageScroller>
						</MessageScrollerProvider>
					</Demo>
				</Section>

				<Section id="questionnaire" title="Questionnaire" source="components/ui/questionnaire">
					<Demo name="questionnaire" className="block">
						<Questionnaire className="max-w-md">
							<QuestionnaireProgress />
							<QuestionnaireItem name="stack">
								<QuestionnaireTitle>Which stack do you use?</QuestionnaireTitle>
								<QuestionnaireDescription>Pick the one closest to your work.</QuestionnaireDescription>
								<QuestionnaireChoices>
									<QuestionnaireChoice value="web" data-trigger="click">Web</QuestionnaireChoice>
									<QuestionnaireChoice value="mobile">Mobile</QuestionnaireChoice>
								</QuestionnaireChoices>
							</QuestionnaireItem>
						</Questionnaire>
					</Demo>
				</Section>

				<Section id="trace" title="Trace" source="components/ui/trace">
					<Demo name="trace" className="block">
						<Trace className="w-full max-w-md">
							<TraceLine status="running"><TraceIcon>◌</TraceIcon><TraceTitle>Building</TraceTitle></TraceLine>
							<TraceCollapsible>
								<TraceCollapsibleTrigger data-trigger="click">
									<TraceLine><TraceIcon>▸</TraceIcon><TraceTitle>Deploy</TraceTitle></TraceLine>
								</TraceCollapsibleTrigger>
								<TraceCollapsibleContent>
									<TraceDescription>Uploaded to the edge in 4.2s.</TraceDescription>
								</TraceCollapsibleContent>
							</TraceCollapsible>
						</Trace>
					</Demo>
				</Section>
				</Category>
				</div>
			</div>
		</TooltipProvider>
	);
}

const chartConfig = {
	visitors: { label: "Visitors", color: "var(--chart-1)" },
} satisfies ChartConfig;

const chartData = [
	{ month: "Jan", visitors: 186 },
	{ month: "Feb", visitors: 305 },
	{ month: "Mar", visitors: 237 },
	{ month: "Apr", visitors: 273 },
	{ month: "May", visitors: 209 },
	{ month: "Jun", visitors: 314 },
];

/** Pagination with its own state, so the active page moves when a link is clicked. */
function PagerDemo() {
	const [page, setPage] = React.useState(1);
	const go = (n: number) => (e: React.MouseEvent) => {
		e.preventDefault();
		setPage(n);
	};
	return (
		<Pagination>
			<PaginationContent>
				<PaginationItem><PaginationPrevious href="#" onClick={go(Math.max(1, page - 1))} /></PaginationItem>
				<PaginationItem><PaginationLink href="#" isActive={page === 1} onClick={go(1)}>1</PaginationLink></PaginationItem>
				<PaginationItem><PaginationLink href="#" isActive={page === 2} onClick={go(2)} data-trigger="click">2</PaginationLink></PaginationItem>
				<PaginationItem><PaginationNext href="#" onClick={go(Math.min(3, page + 1))} /></PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
