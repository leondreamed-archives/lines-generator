import fs from "fs";
import { PDFDocument, PDFPage } from "pdf-lib";

type CenterLineSection =
	| {
			minNumLines: number;
			maxNumLines: number;
			skipInterval: number;
	  }
	| {
			numLines: number;
	  };

type LinesGeneratorConfig = {
	centerLines: CenterLineSection[];
	pageHeight: number;
	pageWidth: number;
};

const config: LinesGeneratorConfig = {
	centerLines: [
		{ 
			minNumLines: 9,
			maxNumLines: 29,
			skipInterval: 2
		},
	],
	pageHeight: 1054,
	pageWidth: 816,
};

type DrawSectionProps = {
	page: PDFPage;
	x: number;
	y: number;
	width: number;
	height: number;
	numCenterLines: number;
};

function drawSection({
	page,
	x,
	y,
	width,
	height,
	numCenterLines,
}: DrawSectionProps) {
	const lineSpacing = width / (numCenterLines + 1);
	for (let lineIndex = 0; lineIndex < numCenterLines; lineIndex += 1) {
		const lineX = x + (lineIndex + 1) * lineSpacing;
		const start = { x: lineX, y };
		const end = { x: lineX, y: y + height };
		// Mountain fold
		if (lineIndex % 2 === 0) {
			// Represented by dash-dot lines
			page.drawLine({
				dashArray: [4, 2, 1, 2],
				start,
				end,
				thickness: 0,
			});
		}
		// Valley fold
		else {
			// Represented by dashed lines
			page.drawLine({
				dashArray: [4, 1],
				start,
				end,
				thickness: 0,
			});
		}
	}
}

type CreateSectionTrackerProps = {
	pdfDoc: PDFDocument;
};

function createSectionDrawer({ pdfDoc }: CreateSectionTrackerProps) {
	const { pageWidth, pageHeight } = config;

	let currentSectionIndex = 0;
	let currentPage: PDFPage | undefined = undefined;

	async function createSectionedPage() {
		const page = await pdfDoc.addPage();
		// 8.5 in x 11 in
		page.setSize(pageWidth, pageHeight);

		function drawCutLine([[startX, startY], [endX, endY]]: [
			[number, number],
			[number, number]
		]) {
			page.drawLine({
				start: { x: startX, y: startY },
				end: { x: endX, y: endY },
				thickness: 0,
				dashArray: [10, 10],
			});
		}

		// Left border
		drawCutLine([
			[0.5, 0],
			[0.5, pageHeight],
		]);

		// Right border
		drawCutLine([
			[pageWidth - 0.5, 0],
			[pageWidth - 0.5, pageHeight],
		]);

		// Top border
		drawCutLine([
			[0, pageHeight - 0.5],
			[pageWidth, pageHeight - 0.5],
		]);

		// Bottom border
		drawCutLine([
			[0, 0],
			[pageWidth, 0],
		]);

		// Center line
		drawCutLine([
			[0, pageHeight / 2],
			[pageWidth, pageHeight / 2],
		]);


		return page;
	}

	return {
		async drawNextSection({ numCenterLines }: { numCenterLines: number }) {
			currentPage = await createSectionedPage();

			if (currentPage === undefined) {
				throw new Error("Current page is undefined");
			}


			drawSection({
				page: currentPage,
				height: pageHeight,
				width: pageWidth,
				numCenterLines,
				x: 0,
				y: 0
			});
		},
	};
}

(async () => {
	const { centerLines } = config;

	const pdfDoc = await PDFDocument.create();

	const { drawNextSection } = createSectionDrawer({ pdfDoc });

	for (const currentCenterLines of centerLines) {
		if ("numLines" in currentCenterLines) {
			await drawNextSection({
				numCenterLines: currentCenterLines.numLines,
			});
		} else {
			const { minNumLines, maxNumLines, skipInterval } = currentCenterLines;

			for (
				let numCenterLines = minNumLines;
				numCenterLines <= maxNumLines;
				numCenterLines += skipInterval
			) {
				await drawNextSection({ numCenterLines });
			}
		}
	}

	const pdfBytes = await pdfDoc.save();

	fs.writeFileSync("lines.pdf", pdfBytes);
})();
