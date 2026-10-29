import { about } from "../data/about";

export function Intro() {
	return (
		<div className="intro not-prose max-w-[62ch]">
			<p className="mb-4 text-lg leading-[1.6]">{about.intro}</p>
		</div>
	);
}
