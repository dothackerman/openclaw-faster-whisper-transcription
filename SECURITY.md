# Security and privacy

The plugin runs trusted local code and a configured Python executable. Only the
operator should control its config, package, environment, and model files. The
runtime uses private pipes with no listening port, does not download models,
and does not pass the Gateway environment or credentials to the sidecar. Normal
logs contain neither audio nor transcripts; native stderr is discarded.

Report security problems privately to the repository owner using GitHub's private
vulnerability reporting when enabled. Do not include user recordings, transcripts,
secrets, or private filesystem paths in public issues. Use synthetic reproductions.

This project does not yet have a production support commitment. Dependency and
model licenses apply separately from this repository's MIT license. CUDA/cuDNN
binaries are obtained by explicit provisioning; none are bundled in npm artifacts.
