import { Skeleton } from "@/components/ui/skeleton";

export default function ReportDetailLoading() {
	return (
		<div className="container py-10 space-y-10">
			<div className="flex items-center gap-2">
				<Skeleton className="h-4 w-12" />
				<Skeleton className="h-4 w-4" />
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-4 w-4" />
				<Skeleton className="h-4 w-40" />
			</div>

			<div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
				<div className="space-y-8 lg:col-span-2">
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-2">
							<Skeleton className="h-7 w-20 rounded-full" />
							<Skeleton className="h-7 w-32 rounded-full" />
							<Skeleton className="ml-auto h-5 w-24" />
						</div>
						<Skeleton className="h-10 w-4/5" />
						<Skeleton className="h-28 w-full rounded-xl" />
					</div>

					<div className="space-y-3">
						<Skeleton className="h-7 w-28" />
						<Skeleton className="h-64 w-full rounded-2xl" />
					</div>
				</div>

				<div className="space-y-8">
					<Skeleton className="h-72 w-full rounded-xl" />
					<Skeleton className="h-56 w-full rounded-xl" />
				</div>
			</div>
		</div>
	);
}
