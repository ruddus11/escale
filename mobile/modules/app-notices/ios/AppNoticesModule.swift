import Compression
import ExpoModulesCore

// 네이티브 SDK가 앱 안에 넣어 두는 법적 고지문을 읽는다.
// Google 지도 SDK는 쓰는 오픈소스의 라이선스를 앱 안에서 볼 수 있게 하라고 요구한다(GMSServices.openSourceLicenseInfo 설명).
// SDK에 직접 의존하지 않도록 SDK 리소스 묶음의 gzip 파일을 읽는다. 지도 SDK가 없는 빌드에서는 nil.
public class AppNoticesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppNotices")

    AsyncFunction("googleMapsNotices") { () -> String? in
      guard
        let resources = Bundle.main.url(forResource: "GoogleMapsResources", withExtension: "bundle"),
        let data = try? Data(contentsOf: resources.appendingPathComponent("GoogleMaps.bundle/oss_licenses_maps.txt.gz")),
        let text = gunzip(data)
      else { return nil }
      return String(data: text, encoding: .utf8)
    }
  }
}

// gzip 머리(10바이트와 선택 필드)를 건너뛰고 deflate 본문을 푼다. 원래 크기는 꼬리 마지막 4바이트(little endian)에 있다.
// Compression의 COMPRESSION_ZLIB은 머리 없는 deflate(RFC 1951)를 푼다.
private func gunzip(_ data: Data) -> Data? {
  let bytes = [UInt8](data)
  guard bytes.count > 18, bytes[0] == 0x1f, bytes[1] == 0x8b, bytes[2] == 8 else { return nil }
  let flags = bytes[3]
  var start = 10
  if flags & 0x04 != 0 { start += 2 + (Int(bytes[start]) | Int(bytes[start + 1]) << 8) }
  if flags & 0x08 != 0 { while start < bytes.count, bytes[start] != 0 { start += 1 }; start += 1 }
  if flags & 0x10 != 0 { while start < bytes.count, bytes[start] != 0 { start += 1 }; start += 1 }
  if flags & 0x02 != 0 { start += 2 }
  let end = bytes.count - 8
  guard start < end else { return nil }
  let size = Int(bytes[end + 4]) | Int(bytes[end + 5]) << 8 | Int(bytes[end + 6]) << 16 | Int(bytes[end + 7]) << 24
  // 고지문은 수 MB 이하다. 이상한 크기는 받지 않는다.
  guard size > 0, size < 50_000_000 else { return nil }
  var output = [UInt8](repeating: 0, count: size)
  let written = bytes[start..<end].withUnsafeBufferPointer { source in
    output.withUnsafeMutableBufferPointer { destination in
      compression_decode_buffer(destination.baseAddress!, size, source.baseAddress!, source.count, nil, COMPRESSION_ZLIB)
    }
  }
  return written == size ? Data(output) : nil
}
