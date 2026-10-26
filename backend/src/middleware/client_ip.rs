use crate::{
    error::{AppError, AppResult},
    state::AppState,
};
use axum::{extract::ConnectInfo, http::Request};
use std::net::{IpAddr, SocketAddr};
pub fn normalize(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V6(v) => v.to_ipv4_mapped().map(IpAddr::V4).unwrap_or(ip),
        _ => ip,
    }
}
pub fn client<B>(state: &AppState, request: &Request<B>) -> AppResult<(IpAddr, bool)> {
    let peer = match request.extensions().get::<ConnectInfo<SocketAddr>>() {
        Some(peer) => peer.0.ip(),
        None if !state.config.production => IpAddr::from([127, 0, 0, 1]),
        None => return Err(AppError::unavailable()),
    };
    let trusted = state
        .config
        .trusted_proxies
        .iter()
        .any(|n| n.contains(&peer));
    if !trusted {
        return Ok((normalize(peer), false));
    }
    let Some(raw) = request.headers().get("x-forwarded-for") else {
        return Ok((normalize(peer), true));
    };
    let raw = raw.to_str().map_err(|_| AppError::bad())?;
    if raw.len() > 1024 {
        return Err(AppError::bad());
    }
    let chain = raw
        .split(',')
        .map(|s| {
            s.trim()
                .parse::<IpAddr>()
                .map(normalize)
                .map_err(|_| AppError::bad())
        })
        .collect::<AppResult<Vec<_>>>()?;
    let mut ip = normalize(peer);
    for candidate in chain.into_iter().rev() {
        if !state.config.trusted_proxies.iter().any(|n| n.contains(&ip)) {
            break;
        }
        ip = candidate;
    }
    Ok((ip, true))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mapped_ipv6_has_one_canonical_identity() {
        assert_eq!(
            normalize("::ffff:192.0.2.1".parse().unwrap()),
            "192.0.2.1".parse::<IpAddr>().unwrap()
        );
    }
}
