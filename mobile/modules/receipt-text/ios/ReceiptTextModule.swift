import ExpoModulesCore
import Vision
import UIKit

// 영수증·예약 사진의 글자를 기기 안에서 읽는다(Apple Vision). 사진은 밖으로 보내지 않는다.
public class ReceiptTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReceiptText")

    // 위에서 아래 순서의 줄 목록.
    AsyncFunction("recognize") { (uri: String, promise: Promise) in
      Self.read(uri, promise) { observations in
        observations.compactMap { $0.topCandidates(1).first?.string }
      }
    }

    // 두 단으로 나뉜 예약 확인서(구간 1 | 구간 2)를 단별로 다시 읽을 수 있게 위치도 돌려준다.
    // 좌표는 0~1 비율이며 왼쪽 위가 원점이다. Vision 기본값(왼쪽 아래 원점)과 다르다.
    AsyncFunction("recognizeBlocks") { (uri: String, promise: Promise) in
      Self.read(uri, promise) { observations in
        observations.compactMap { observation -> [String: Any]? in
          guard let text = observation.topCandidates(1).first?.string else { return nil }
          let box = observation.boundingBox
          return ["text": text, "x": box.minX, "y": 1 - box.maxY, "width": box.width, "height": box.height]
        }
      }
    }
  }

  private static func read(_ uri: String, _ promise: Promise, _ output: @escaping ([VNRecognizedTextObservation]) -> Any) {
    guard let url = URL(string: uri), let data = try? Data(contentsOf: url), let image = UIImage(data: data), let cgImage = image.cgImage else {
      promise.reject("E_IMAGE", "Could not open the image")
      return
    }
    let request = VNRecognizeTextRequest { request, error in
      if let error = error {
        promise.reject("E_VISION", error.localizedDescription)
        return
      }
      // Vision 좌표는 아래가 0이라 위에서부터 읽도록 뒤집어 정렬한다.
      let observations = ((request.results as? [VNRecognizedTextObservation]) ?? [])
        .sorted { a, b in
          let dy = b.boundingBox.midY - a.boundingBox.midY
          return abs(dy) > 0.01 ? dy < 0 : a.boundingBox.minX < b.boundingBox.minX
        }
      promise.resolve(output(observations))
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["ko-KR", "ja-JP", "en-US", "zh-Hans", "fr-FR", "de-DE", "es-ES", "it-IT", "pt-BR"]
    let orientation = CGImagePropertyOrientation(image.imageOrientation)
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        try VNImageRequestHandler(cgImage: cgImage, orientation: orientation).perform([request])
      } catch {
        promise.reject("E_VISION", error.localizedDescription)
      }
    }
  }
}

extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up: self = .up
    case .down: self = .down
    case .left: self = .left
    case .right: self = .right
    case .upMirrored: self = .upMirrored
    case .downMirrored: self = .downMirrored
    case .leftMirrored: self = .leftMirrored
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
