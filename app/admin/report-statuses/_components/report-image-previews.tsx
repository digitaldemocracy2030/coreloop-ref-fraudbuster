"use client";

import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type ReportImagePreviewItem = {
	id: string;
	previewUrl: string;
};

type ReportImagePreviewsProps = {
	title: string;
	images: ReportImagePreviewItem[];
	remainingImageCount: number;
};

export function ReportImagePreviews({
	title,
	images,
	remainingImageCount,
}: ReportImagePreviewsProps) {
	const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
	const selectedImage =
		selectedIndex !== null ? (images[selectedIndex] ?? null) : null;

	const showPrevious = React.useCallback(() => {
		setSelectedIndex((current) => {
			if (current === null || images.length === 0) {
				return current;
			}

			return current === 0 ? images.length - 1 : current - 1;
		});
	}, [images.length]);

	const showNext = React.useCallback(() => {
		setSelectedIndex((current) => {
			if (current === null || images.length === 0) {
				return current;
			}

			return current === images.length - 1 ? 0 : current + 1;
		});
	}, [images.length]);

	return (
		<>
			<div className="flex shrink-0 flex-wrap items-center gap-2 lg:w-[11.5rem] lg:justify-end">
				{images.map((image, index) => (
					<button
						key={image.id}
						type="button"
						onClick={() => setSelectedIndex(index)}
						className="group relative overflow-hidden rounded-md border bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						aria-label={`${title} の証拠画像 ${index + 1} を拡大表示`}
					>
						<Image
							src={image.previewUrl}
							alt={`${title} の証拠画像 ${index + 1}`}
							width={80}
							height={80}
							className="h-14 w-14 object-cover transition group-hover:scale-105"
						/>
						<span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
							<Expand className="h-4 w-4" />
						</span>
					</button>
				))}
				{remainingImageCount > 0 ? (
					<div className="flex h-14 min-w-14 items-center justify-center rounded-md border border-dashed px-2 text-xs text-muted-foreground">
						+{remainingImageCount}枚
					</div>
				) : null}
			</div>

			<Dialog
				open={selectedIndex !== null}
				onOpenChange={(open) => {
					if (!open) {
						setSelectedIndex(null);
					}
				}}
			>
				<DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[min(96vw,1200px)] overflow-hidden border-0 bg-transparent p-0 shadow-none">
					<DialogHeader className="sr-only">
						<DialogTitle>
							{selectedIndex !== null
								? `${title} の拡大画像 ${selectedIndex + 1}`
								: `${title} の拡大画像`}
						</DialogTitle>
					</DialogHeader>
					{selectedImage ? (
						<div className="relative flex max-h-[92dvh] items-center justify-center">
							<Image
								src={selectedImage.previewUrl}
								alt={
									selectedIndex !== null
										? `${title} の拡大画像 ${selectedIndex + 1}`
										: `${title} の拡大画像`
								}
								width={1600}
								height={2200}
								priority
								className="max-h-[92dvh] w-auto max-w-full object-contain"
							/>
							{images.length > 1 ? (
								<>
									<button
										type="button"
										onClick={showPrevious}
										className="absolute left-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
										aria-label="前の画像を表示"
									>
										<ChevronLeft className="h-5 w-5" />
									</button>
									<button
										type="button"
										onClick={showNext}
										className="absolute right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
										aria-label="次の画像を表示"
									>
										<ChevronRight className="h-5 w-5" />
									</button>
									<div className="absolute right-3 bottom-3 rounded-full bg-background/85 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
										{selectedIndex !== null ? selectedIndex + 1 : 1} /{" "}
										{images.length}
									</div>
								</>
							) : null}
						</div>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
