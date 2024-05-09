let userName = "user-" + Date.now();
let password = "x";

document.getElementById("userName").innerHTML = userName;

let socket = io.connect("https://192.168.1.7:8181", {
  auth: {
    userName,
    password,
  },
});

let controls = document.getElementById("controls");

let localAudioEl = document.getElementById("localAudio");
let remoteAudioEl = document.getElementById("remoteAudio");

let localStream = new MediaStream();

let remoteStream = new MediaStream();

let didIOffer = false;

let peerConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    },
  ],
};

let call = async (e) => {
  await fetchUserMedia();

  await createPeerConnection();

  try {
    let offer = await peerConnection.createOffer();
    peerConnection.setLocalDescription(offer);
    didIOffer = true;
    socket.emit("newOffer", offer);
  } catch (err) {
    console.log(err);
  }
};

let answerOffer = async (offerObj) => {
  await fetchUserMedia();
  await createPeerConnection(offerObj);
  let answer = await peerConnection.createAnswer({}); //just to make the docs happy
  await peerConnection.setLocalDescription(answer); //this is CLIENT2, and CLIENT2 uses the answer as the localDesc

  offerObj.answer = answer;

  let offerIceCandidates = await socket.emitWithAck("newAnswer", offerObj);
  offerIceCandidates.forEach((c) => {
    peerConnection.addIceCandidate(c);
  });
};

let addAnswer = async (offerObj) => {
  await peerConnection.setRemoteDescription(offerObj.answer);
};

let fetchUserMedia = () => {
  return new Promise(async (resolve, reject) => {
    try {
      let stream = await navigator.mediaDevices.getUserMedia({
        // video: true,
        audio: true,
      });
      localAudioEl.srcObject = stream;
      localStream = stream;
      resolve();
    } catch (err) {
      reject();
    }
  });
};

let createPeerConnection = (offerObj) => {
  return new Promise(async (resolve, reject) => {
    peerConnection = await new RTCPeerConnection(peerConfiguration);
    remoteStream = new MediaStream();
    remoteAudioEl.srcObject = remoteStream;

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.addEventListener("icecandidate", (e) => {
      if (e.candidate) {
        socket.emit("sendIceCandidateToSignalingServer", {
          iceCandidate: e.candidate,
          iceUserName: userName,
          didIOffer,
        });
      }
    });

    peerConnection.addEventListener("track", (e) => {
      e.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track, remoteStream);
      });
    });

    if (offerObj) {
      await peerConnection.setRemoteDescription(offerObj.offer);
    }
    resolve();
  });
};

let addNewIceCandidate = (iceCandidate) => {
  peerConnection.addIceCandidate(iceCandidate);
};

document.getElementById("call").addEventListener("click", call);

socket.on("availableOffers", (offers) => {
  createOfferEls(offers);
});

socket.on("newOfferAwaiting", (offers) => {
  createOfferEls(offers);
});

socket.on("answerResponse", (offerObj) => {
  console.log(offerObj);
  addAnswer(offerObj);
});

socket.on("receivedIceCandidateFromServer", (iceCandidate) => {
  addNewIceCandidate(iceCandidate);
  console.log(iceCandidate);
});

function createOfferEls(offers) {
  offers.forEach((o) => {
    let answerBtn = document.createElement("button");
    answerBtn.classList.add("btn", "px-3", "btn-success");
    answerBtn.innerText = `Answer ${o.offererUserName}`;
    answerBtn.addEventListener("click", () => answerOffer(o));

    controls.insertAdjacentElement("beforeend", answerBtn);
  });
}
