import { Page } from "../components/Page";
import { ResumeFacts } from "../components/ResumeFacts";
import { resume } from "../data/resume";

export function ResumePage() {
	return (
		<Page>
			<h1>{resume.name}</h1>
			<ResumeFacts level={2} />
		</Page>
	);
}
