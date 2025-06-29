const { spawn } = require("child_process")
const path = require("path")

class BotManager {
  constructor() {
    this.buyBotProcess = null
    this.sellBotProcess = null
    this.isRunning = false
    this.startTime = null
  }

  start() {
    if (this.isRunning) {
      console.log("⚠️  봇이 이미 실행 중입니다")
      return
    }

    console.log("🚀 매매봇 시스템 시작")
    console.log("=".repeat(50))
    this.startTime = new Date()

    // 매수봇 시작
    console.log("🔵 매수봇 시작 중...")
    this.buyBotProcess = spawn("node", [path.join(__dirname, "buyBot.js")], {
      stdio: "inherit",
    })

    this.buyBotProcess.on("error", (error) => {
      console.error("🔵 매수봇 오류:", error)
    })

    this.buyBotProcess.on("exit", (code) => {
      console.log(`🔵 매수봇 종료 (코드: ${code})`)
      if (code !== 0 && this.isRunning) {
        console.log("🔄 매수봇 5초 후 재시작...")
        setTimeout(() => this.restartBuyBot(), 5000)
      }
    })

    // 매도봇 시작 (2초 후)
    setTimeout(() => {
      console.log("🔴 매도봇 시작 중...")
      this.sellBotProcess = spawn("node", [path.join(__dirname, "sellBot.js")], {
        stdio: "inherit",
      })

      this.sellBotProcess.on("error", (error) => {
        console.error("🔴 매도봇 오류:", error)
      })

      this.sellBotProcess.on("exit", (code) => {
        console.log(`🔴 매도봇 종료 (코드: ${code})`)
        if (code !== 0 && this.isRunning) {
          console.log("🔄 매도봇 5초 후 재시작...")
          setTimeout(() => this.restartSellBot(), 5000)
        }
      })

      console.log("🔴 매도봇 시작됨")
    }, 2000)

    this.isRunning = true

    // 상태 모니터링 (30초마다)
    this.statusInterval = setInterval(() => {
      this.showStatus()
    }, 30000)

    console.log("✅ 매매봇 시스템이 성공적으로 시작되었습니다")
    console.log("📊 30초마다 상태가 업데이트됩니다")
    console.log("🛑 종료하려면 Ctrl+C를 누르세요")
    console.log("=".repeat(50))
  }

  stop() {
    if (!this.isRunning) {
      console.log("⚠️  봇이 실행 중이 아닙니다")
      return
    }

    console.log("\n🛑 매매봇 시스템 종료 중...")

    this.isRunning = false

    if (this.statusInterval) {
      clearInterval(this.statusInterval)
    }

    if (this.buyBotProcess && !this.buyBotProcess.killed) {
      this.buyBotProcess.kill("SIGTERM")
      console.log("🔵 매수봇 종료됨")
    }

    if (this.sellBotProcess && !this.sellBotProcess.killed) {
      this.sellBotProcess.kill("SIGTERM")
      console.log("🔴 매도봇 종료됨")
    }

    console.log("✅ 매매봇 시스템이 완전히 종료되었습니다")
  }

  restartBuyBot() {
    if (!this.isRunning) return

    if (this.buyBotProcess && !this.buyBotProcess.killed) {
      this.buyBotProcess.kill()
    }

    this.buyBotProcess = spawn("node", [path.join(__dirname, "buyBot.js")], {
      stdio: "inherit",
    })

    this.buyBotProcess.on("error", (error) => {
      console.error("🔵 매수봇 오류:", error)
    })

    this.buyBotProcess.on("exit", (code) => {
      console.log(`🔵 매수봇 종료 (코드: ${code})`)
      if (code !== 0 && this.isRunning) {
        setTimeout(() => this.restartBuyBot(), 5000)
      }
    })

    console.log("🔄 매수봇 재시작됨")
  }

  restartSellBot() {
    if (!this.isRunning) return

    if (this.sellBotProcess && !this.sellBotProcess.killed) {
      this.sellBotProcess.kill()
    }

    this.sellBotProcess = spawn("node", [path.join(__dirname, "sellBot.js")], {
      stdio: "inherit",
    })

    this.sellBotProcess.on("error", (error) => {
      console.error("🔴 매도봇 오류:", error)
    })

    this.sellBotProcess.on("exit", (code) => {
      console.log(`🔴 매도봇 종료 (코드: ${code})`)
      if (code !== 0 && this.isRunning) {
        setTimeout(() => this.restartSellBot(), 5000)
      }
    })

    console.log("🔄 매도봇 재시작됨")
  }

  showStatus() {
    if (!this.isRunning) return

    const uptime = Math.floor((Date.now() - this.startTime) / 1000)
    const uptimeStr = this.formatUptime(uptime)

    console.log("\n" + "=".repeat(50))
    console.log("📊 매매봇 시스템 상태")
    console.log(`⏰ 가동시간: ${uptimeStr}`)
    console.log(`🔵 매수봇: ${this.buyBotProcess && !this.buyBotProcess.killed ? "실행중" : "중지됨"}`)
    console.log(`🔴 매도봇: ${this.sellBotProcess && !this.sellBotProcess.killed ? "실행중" : "중지됨"}`)
    console.log(`🕐 현재시간: ${new Date().toLocaleString()}`)
    console.log("=".repeat(50))
  }

  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}시간 ${minutes}분 ${secs}초`
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`
    } else {
      return `${secs}초`
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      buyBotRunning: this.buyBotProcess && !this.buyBotProcess.killed,
      sellBotRunning: this.sellBotProcess && !this.sellBotProcess.killed,
      uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
    }
  }
}

// CLI 인터페이스
if (require.main === module) {
  const botManager = new BotManager()

  // 종료 시그널 처리
  process.on("SIGINT", () => {
    console.log("\n🛑 종료 신호를 받았습니다...")
    botManager.stop()
    setTimeout(() => {
      process.exit(0)
    }, 2000)
  })

  process.on("SIGTERM", () => {
    console.log("\n🛑 종료 신호를 받았습니다...")
    botManager.stop()
    setTimeout(() => {
      process.exit(0)
    }, 2000)
  })

  const command = process.argv[2]

  switch (command) {
    case "start":
      botManager.start()
      break
    case "stop":
      botManager.stop()
      break
    case "status":
      const status = botManager.getStatus()
      console.log("📊 봇 상태:")
      console.log(`   실행중: ${status.isRunning ? "예" : "아니오"}`)
      console.log(`   매수봇: ${status.buyBotRunning ? "실행중" : "중지됨"}`)
      console.log(`   매도봇: ${status.sellBotRunning ? "실행중" : "중지됨"}`)
      console.log(`   가동시간: ${botManager.formatUptime(status.uptime)}`)
      break
    case "restart":
      console.log("🔄 봇 재시작 중...")
      botManager.stop()
      setTimeout(() => {
        botManager.start()
      }, 3000)
      break
    default:
      console.log("🤖 매매봇 관리자")
      console.log("사용법: node manager.js [start|stop|status|restart]")
      console.log("")
      console.log("명령어:")
      console.log("  start   - 봇 시작")
      console.log("  stop    - 봇 중지")
      console.log("  status  - 봇 상태 확인")
      console.log("  restart - 봇 재시작")
      console.log("")
      console.log("인수 없이 실행하면 자동으로 시작됩니다.")
      botManager.start()
  }
}

module.exports = BotManager
