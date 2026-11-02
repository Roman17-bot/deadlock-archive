using Microsoft.EntityFrameworkCore;

namespace Deadlock.Api.Data;

public sealed class ArchiveSnapshotRow
{
    public long Id { get; set; }
    public string ContentHash { get; set; } = "";
    public int ClientVersion { get; set; }
    public string HeroMeta { get; set; } = "{}";
    public string Provenance { get; set; } = "{}";
    public DateTime ImportedAt { get; set; }
    public string? ImportReason { get; set; }
}
public sealed class ArchiveCurrentRow
{
    public bool Singleton { get; set; } = true;
    public long SnapshotId { get; set; }
    public ArchiveSnapshotRow Snapshot { get; set; } = null!;
}
/// <summary>EF maps the durable version pointer and metadata. Ordered legacy row imports use one native transaction.</summary>
public sealed class ArchiveDbContext(DbContextOptions<ArchiveDbContext> options) : DbContext(options)
{
    public DbSet<ArchiveSnapshotRow> Snapshots => Set<ArchiveSnapshotRow>();
    public DbSet<ArchiveCurrentRow> Current => Set<ArchiveCurrentRow>();
    protected override void OnModelCreating(ModelBuilder builder)
    {
        var s = builder.Entity<ArchiveSnapshotRow>(); s.ToTable("archive_snapshots"); s.HasKey(x => x.Id); s.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn(); s.Property(x => x.ContentHash).HasColumnName("content_hash"); s.HasIndex(x => x.ContentHash).IsUnique(); s.Property(x => x.ClientVersion).HasColumnName("client_version"); s.Property(x => x.HeroMeta).HasColumnName("hero_meta").HasColumnType("jsonb"); s.Property(x => x.Provenance).HasColumnName("provenance").HasColumnType("jsonb"); s.Property(x => x.ImportedAt).HasColumnName("imported_at").HasDefaultValueSql("now()"); s.Property(x => x.ImportReason).HasColumnName("import_reason");
        var c = builder.Entity<ArchiveCurrentRow>(); c.ToTable("archive_current"); c.HasKey(x => x.Singleton); c.Property(x => x.Singleton).HasColumnName("singleton"); c.Property(x => x.SnapshotId).HasColumnName("snapshot_id"); c.HasOne(x => x.Snapshot).WithMany().HasForeignKey(x => x.SnapshotId).OnDelete(DeleteBehavior.Restrict);
    }
}
