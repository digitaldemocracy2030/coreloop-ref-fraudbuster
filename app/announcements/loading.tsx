import { Skeleton } from "@/components/ui/skeleton";

const ANNOUNCEMENT_LOADING_IDS = [
	"announcement-loading-1",
	"announcement-loading-2",
	"announcement-loading-3",
	"announcement-loading-4",
];

export default function AnnouncementsLoading() {
	return (
		<div className="container py-12 space-y-10">
			<div className="space-y-2">
				<Skeleton className="h-10 w-40" />
				<Skeleton className="h-5 w-2/3" />
			</div>

			<div className="grid gap-6">
				{ANNOUNCEMENT_LOADING_IDS.map((id) => (
					<div key={id} className="rounded-xl border p-6 space-y-4">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-7 w-3/4" />
						<Skeleton className="h-16 w-full" />
						<div className="flex gap-2">
							<Skeleton className="h-5 w-16 rounded-full" />
							<Skeleton className="h-5 w-16 rounded-full" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
