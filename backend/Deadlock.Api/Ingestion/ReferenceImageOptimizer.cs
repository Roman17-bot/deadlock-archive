using System.ComponentModel;
using System.Diagnostics;

namespace Deadlock.Api.Ingestion;

/// <summary>Mechanical image sizing only; official composition is preserved.</summary>
public static class ReferenceImageOptimizer
{
    public static (int Width, int Height) Dimensions(byte[] bytes)
    {
        if (bytes.Length < 30 || !bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) || !bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8)) throw new InvalidDataException("Invalid WebP image");
        int width, height;
        if (bytes.AsSpan(12, 4).SequenceEqual("VP8X"u8)) { width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16); height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16); }
        else if (bytes.AsSpan(12, 4).SequenceEqual("VP8 "u8) && bytes.AsSpan(23, 3).SequenceEqual(new byte[] { 157, 1, 42 })) { width = BitConverter.ToUInt16(bytes, 26) & 16383; height = BitConverter.ToUInt16(bytes, 28) & 16383; }
        else if (bytes.AsSpan(12, 4).SequenceEqual("VP8L"u8) && bytes[20] == 47) { width = 1 + ((bytes[21] | (bytes[22] << 8)) & 16383); height = 1 + (((bytes[22] >> 6) | (bytes[23] << 2) | (bytes[24] << 10)) & 16383); }
        else throw new InvalidDataException("Unsupported WebP dimensions");
        if (width is < 1 or > 16384 || height is < 1 or > 16384 || (long)width * height > 40_000_000) throw new InvalidDataException("Image dimensions exceed bounds");
        return (width, height);
    }
    public static async Task<byte[]> OptimizeAsync(byte[] input, CancellationToken ct)
    {
        Dimensions(input);
        foreach (var width in new[] { 1280, 1024 })
        {
            var start = new ProcessStartInfo("ffmpeg") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true };
            foreach (var arg in new[] { "-nostdin", "-hide_banner", "-loglevel", "error", "-threads", "1", "-filter_threads", "1", "-i", "pipe:0", "-vf", $"scale=w='min({width},iw)':h=-2", "-frames:v", "1", "-c:v", "libwebp", "-quality", "75", "-compression_level", "6", "-f", "webp", "pipe:1" }) start.ArgumentList.Add(arg);
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromSeconds(15));
            Process process;
            try { process = Process.Start(start) ?? throw new PlatformNotSupportedException("ffmpeg is unavailable"); }
            catch (Win32Exception) { throw new PlatformNotSupportedException("Full hero art optimization requires ffmpeg; official cards remain supported."); }
            using (process)
            try
            {
                async Task<byte[]> Read(Stream stream)
                {
                    using var output = new MemoryStream(); var buffer = new byte[16384]; int count;
                    while ((count = await stream.ReadAsync(buffer, deadline.Token)) > 0) { if (output.Length + count > 512 * 1024) throw new InvalidDataException("Optimized image exceeds bounds"); await output.WriteAsync(buffer.AsMemory(0, count), deadline.Token); } return output.ToArray();
                }
                var output = Read(process.StandardOutput.BaseStream); var error = Read(process.StandardError.BaseStream);
                await process.StandardInput.BaseStream.WriteAsync(input, deadline.Token); process.StandardInput.Close();
                await Task.WhenAll(output, error, process.WaitForExitAsync(deadline.Token));
                if (process.ExitCode != 0) throw new InvalidDataException("Image optimization failed"); var result = await output; var dimensions = Dimensions(result);
                if (dimensions.Width > 1280 || dimensions.Height > 4096) throw new InvalidDataException("Optimized dimensions exceed bounds");
                if (result.Length <= 256 * 1024) return result;
            }
            finally { if (!process.HasExited) process.Kill(true); }
        }
        throw new InvalidDataException("Hero art cannot fit approved output bounds");
    }
}
