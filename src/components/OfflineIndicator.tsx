export default function OfflineIndicator() {
  return (
    <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-900/80 backdrop-blur-sm">
      <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
      <span className="text-[10px] font-medium text-orange-300 tracking-wide">
        Offline
      </span>
    </div>
  );
}
