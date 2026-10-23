// Live demos for /ui/ that have to be one React tree: Radix Tabs parts share context, and Card parts
// read each other through :has()/group selectors. Page-private (the leading underscore keeps Astro
// from routing it); the library itself is components/ui and components/bg.

import { Button } from "@gjuoun/bigface-ui/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@gjuoun/bigface-ui/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@gjuoun/bigface-ui/components/ui/tabs";

export function CardDemo({ size }: { size: "default" | "sm" }) {
  return (
    <Card size={size} className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Card · size={size}</CardTitle>
        <CardDescription>Header, title, description and an action.</CardDescription>
        <CardAction>
          <Button variant="outline" size="xs">
            Action
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>The content slot. Spacing follows the size.</CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Primary</Button>
        <Button variant="ghost" size="sm">
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}

export function TabsDemo({
  variant,
  orientation,
}: {
  variant: "default" | "line";
  orientation: "horizontal" | "vertical";
}) {
  return (
    <Tabs defaultValue="one" orientation={orientation}>
      <TabsList variant={variant} aria-label={`Tabs demo: ${variant}, ${orientation}`}>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
        <TabsTrigger value="three" disabled>
          Disabled
        </TabsTrigger>
      </TabsList>
      <TabsContent value="one" className="px-1 text-bf-fg-muted">
        First panel.
      </TabsContent>
      <TabsContent value="two" className="px-1 text-bf-fg-muted">
        Second panel.
      </TabsContent>
    </Tabs>
  );
}
