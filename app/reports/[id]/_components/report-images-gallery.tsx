"use client";

import { Expand } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import {
	Carousel,
	type CarouselApi,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type ReportImageItem = {
	id: string;
	imageUrl: string;
};

type ReportImagesGalleryProps = {
	title: string;
	images: ReportImageItem[];
};

function SlideCounter({ current, total }: { current: number; total: number }) {
	return (
		<div className="rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
			{current} / {total}
		</div>
	);
}

export function ReportImagesGallery({
	title,
	images,
}: ReportImagesGalleryProps) {
	const [mainApi, setMainApi] = React.useState<CarouselApi>();
	const [currentIndex, setCurrentIndex] = React.useState(0);
	const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);
	const [lightboxOpen, setLightboxOpen] = React.useState(false);
	const totalImages = images.length;

	React.useEffect(() => {
		if (!mainApi) {
			return;
		}

		const syncIndex = () => {
			setCurrentIndex(mainApi.selectedScrollSnap());
		};

		syncIndex();
		mainApi.on("select", syncIndex);
		mainApi.on("reInit", syncIndex);

		return () => {
			mainApi.off("select", syncIndex);
		};
	}, [mainApi]);

	const openLightbox = React.useCallback((index: number) => {
		setSelectedImageIndex(index);
		setLightboxOpen(true);
	}, []);

	const selectedImage = images[selectedImageIndex] ?? null;

	return (
		<>
			<div className="space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<p className="text-sm text-muted-foreground">
						OGP画像やスクリーンショットなどの証拠画像が追加されたらこちらに表示されます。
					</p>
					{totalImages > 1 ? (
						<SlideCounter current={currentIndex + 1} total={totalImages} />
					) : null}
				</div>

				<Carousel
					setApi={setMainApi}
					opts={{ align: "start", loop: totalImages > 1 }}
					className="mx-12"
				>
					<CarouselContent>
						{images.map((image, index) => (
							<CarouselItem key={image.id}>
								<button
									type="button"
									onClick={() => openLightbox(index)}
									className="group relative block w-full overflow-hidden rounded-2xl border bg-muted/20 p-3 text-left transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								>
									<div className="relative flex h-[420px] items-center justify-center overflow-hidden rounded-xl bg-linear-to-b from-muted/50 to-background">
										<Image
											src={image.imageUrl}
											alt={`${title} の関連画像 ${index + 1}`}
											width={1200}
											height={1600}
											loading="lazy"
											className="h-full w-full object-contain"
										/>
										<div className="absolute top-3 right-3 inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
											<Expand className="h-3.5 w-3.5" />
											拡大表示
										</div>
									</div>
								</button>
							</CarouselItem>
						))}
					</CarouselContent>
					{totalImages > 1 ? (
						<>
							<CarouselPrevious className="left-3" />
							<CarouselNext className="right-3" />
						</>
					) : null}
				</Carousel>
			</div>

			<Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
				<DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[min(96vw,1200px)] overflow-hidden border-0 bg-transparent p-0 shadow-none">
					<DialogHeader className="sr-only">
						<DialogTitle>
							{`${title} の拡大画像 ${selectedImageIndex + 1}`}
						</DialogTitle>
					</DialogHeader>
					{selectedImage ? (
						<div className="relative flex max-h-[92dvh] items-center justify-center">
							<Image
								src={selectedImage.imageUrl}
								alt={`${title} の拡大画像 ${selectedImageIndex + 1}`}
								width={1600}
								height={2200}
								priority
								className="max-h-[92dvh] w-auto max-w-full object-contain"
							/>
						</div>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
